import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { AppleMapsService } from '../maps/apple-maps.service';
import { CreateEmergencyDto } from './dto/create-emergency.dto';
import { limitContactsForSubscription } from '../subscription/subscription-entitlement';

type HelpContact = {
  id: string;
  name: string;
  phone: string;
};

type EmergencyDeliveryStatus = 'sent' | 'partial' | 'failed' | 'no_contacts';
type AddressSource = 'manual' | 'user_preset' | 'apple_client' | 'apple_server' | null;
type MapsProvider = 'user' | 'apple_core_location' | 'apple_maps_server' | null;

interface AddressCandidate {
  text: string;
  source: AddressSource;
  provider: MapsProvider;
  locked: boolean;
}

interface UserAddressData {
  address?: string | null;
  addressLatitude?: number | null;
  addressLongitude?: number | null;
}

const PRESET_MATCH_RADIUS_METERS = 100;

export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildAppleMapsUrl(latitude: number, longitude: number): string {
  return `https://maps.apple.com/?ll=${latitude},${longitude}`;
}

@Injectable()
export class HelpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    private readonly appleMapsService: AppleMapsService,
  ) {}

  async emergency(userId: string, dto: CreateEmergencyDto) {
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('经纬度必须同时提供');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        contacts: { where: { verified: true }, orderBy: { priority: 'asc' } },
        subscription: true,
      },
    });

    const hasCoordinates = hasLatitude && hasLongitude;
    const immediateAddress = this.resolveImmediateAddress(user ?? {}, dto, hasCoordinates);
    const mapUrl = hasCoordinates
      ? buildAppleMapsUrl(dto.latitude as number, dto.longitude as number)
      : null;
    const locationCapturedAt = dto.locationCapturedAt
      ? new Date(dto.locationCapturedAt)
      : null;

    const helpRequest = await this.prisma.helpRequest.create({
      data: {
        userId,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        accuracyMeters: dto.accuracyMeters ?? null,
        locationCapturedAt,
        fixSource: dto.fixSource ?? null,
        precisionAuthorization: dto.precisionAuthorization ?? null,
        addressText: immediateAddress.text,
        addressSource: immediateAddress.source ?? dto.addressSource ?? null,
        addressConfirmed: dto.addressConfirmed ?? false,
        mapsProvider: immediateAddress.provider,
        mapUrl,
      },
    });

    let resolvedAddress = immediateAddress;
    if (hasCoordinates && !immediateAddress.locked) {
      const serverAddress = await this.appleMapsService.reverseGeocode(
        dto.latitude as number,
        dto.longitude as number,
      );
      if (serverAddress?.address) {
        resolvedAddress = {
          text: serverAddress.address,
          source: 'apple_server',
          provider: serverAddress.provider,
          locked: true,
        };
      }
    }

    if (
      resolvedAddress.text !== immediateAddress.text ||
      resolvedAddress.source !== immediateAddress.source ||
      resolvedAddress.provider !== immediateAddress.provider
    ) {
      await this.prisma.helpRequest.update({
        where: { id: helpRequest.id },
        data: {
          addressText: resolvedAddress.text,
          addressSource: resolvedAddress.source,
          mapsProvider: resolvedAddress.provider,
        },
      });
    }

    const nickname = user?.nickname ?? '用户';
    const accuracyPart =
      dto.accuracyMeters !== undefined
        ? `（定位误差约±${Math.max(1, Math.ceil(dto.accuracyMeters))}米）`
        : '';
    const locationPart = resolvedAddress.text
      ? `，位置：${resolvedAddress.text}${accuracyPart}`
      : accuracyPart
        ? `，当前位置${accuracyPart}`
        : '';
    const capturedAtPart = locationCapturedAt
      ? `，定位时间：${new Intl.DateTimeFormat('zh-CN', {
          timeZone: 'Asia/Shanghai',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(locationCapturedAt)}`
      : '';
    const mapPart = mapUrl ? `，地图：${mapUrl}` : '';
    const message = `【今天还好】${nickname}发起了紧急求助${locationPart}${capturedAtPart}${mapPart}，请尽快联系确认安全。`;

    const eligibleContacts = limitContactsForSubscription(
      user?.contacts ?? [],
      user?.subscription,
    );
    const deliveryResults = await Promise.all(
      eligibleContacts.map(async (contact) => {
        let sent = false;
        let failReason: string | null = null;

        try {
          sent = await this.smsService.sendAlertSms(contact.phone, message);
          if (!sent) failReason = '短信服务商拒绝或未接受发送请求';
        } catch (error: unknown) {
          failReason = error instanceof Error ? error.message : String(error);
        }

        await this.prisma.notificationLog.create({
          data: {
            contactId: contact.id,
            channel: 'sms',
            round: 1,
            status: sent ? 'sent' : 'failed',
            sentAt: sent ? new Date() : null,
            failReason: sent ? null : failReason?.slice(0, 480),
            attempts: 1,
          },
        });

        return {
          contact: {
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
          } satisfies HelpContact,
          sent,
        };
      }),
    );

    const contactsNotified = deliveryResults
      .filter((result) => result.sent)
      .map((result) => result.contact);
    const contactsFailed = deliveryResults
      .filter((result) => !result.sent)
      .map((result) => result.contact);
    const deliveryStatus: EmergencyDeliveryStatus =
      deliveryResults.length === 0
        ? 'no_contacts'
        : contactsFailed.length === 0
          ? 'sent'
          : contactsNotified.length === 0
            ? 'failed'
            : 'partial';
    const responseMessage: Record<EmergencyDeliveryStatus, string> = {
      sent: '求助短信已全部提交发送',
      partial: `部分短信发送失败：成功 ${contactsNotified.length} 位，失败 ${contactsFailed.length} 位`,
      failed: '求助已记录，但短信发送失败，请直接联系紧急联系人',
      no_contacts: '求助已记录，但没有可通知的紧急联系人',
    };

    return {
      id: helpRequest.id,
      createdAt: helpRequest.createdAt.toISOString(),
      address: resolvedAddress.text,
      mapUrl,
      accuracyMeters: dto.accuracyMeters ?? null,
      deliveryStatus,
      contactsNotified,
      contactsFailed,
      message: responseMessage[deliveryStatus],
    };
  }

  async getAddress(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        address: true,
        addressLatitude: true,
        addressLongitude: true,
        addressAccuracyMeters: true,
      },
    });

    return {
      address: user?.address ?? '',
      source: 'user_preset' as const,
      latitude: user?.addressLatitude ?? null,
      longitude: user?.addressLongitude ?? null,
      accuracyMeters: user?.addressAccuracyMeters ?? null,
    };
  }

  private resolveImmediateAddress(
    user: UserAddressData,
    dto: CreateEmergencyDto,
    hasCoordinates: boolean,
  ): AddressCandidate {
    const clientAddress = dto.addressText?.trim() ?? '';

    if (clientAddress && dto.addressConfirmed) {
      return {
        text: clientAddress,
        source: dto.addressSource ?? 'manual',
        provider: 'user',
        locked: true,
      };
    }

    if (
      hasCoordinates &&
      user.address?.trim() &&
      user.addressLatitude !== null &&
      user.addressLatitude !== undefined &&
      user.addressLongitude !== null &&
      user.addressLongitude !== undefined &&
      distanceMeters(
        dto.latitude as number,
        dto.longitude as number,
        user.addressLatitude,
        user.addressLongitude,
      ) <= PRESET_MATCH_RADIUS_METERS
    ) {
      return {
        text: user.address.trim(),
        source: 'user_preset',
        provider: 'user',
        locked: true,
      };
    }

    if (!hasCoordinates) {
      const fallbackAddress = clientAddress || user.address?.trim() || '';
      return {
        text: fallbackAddress,
        source: fallbackAddress ? dto.addressSource ?? 'user_preset' : null,
        provider: fallbackAddress ? 'user' : null,
        locked: true,
      };
    }

    // Backwards compatibility: older clients did not send addressSource.
    if (clientAddress && !dto.addressSource) {
      return {
        text: clientAddress,
        source: 'apple_client',
        provider: 'apple_core_location',
        locked: false,
      };
    }

    if (clientAddress && dto.addressSource === 'apple_client') {
      return {
        text: clientAddress,
        source: 'apple_client',
        provider: 'apple_core_location',
        locked: false,
      };
    }

    // An unmatched saved address may be the user's home while they are elsewhere.
    return { text: '', source: null, provider: null, locked: false };
  }
}
