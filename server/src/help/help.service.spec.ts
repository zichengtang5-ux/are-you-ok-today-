import { Test, TestingModule } from '@nestjs/testing';
import { HelpService, distanceMeters } from './help.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { AppleMapsService } from '../maps/apple-maps.service';

describe('HelpService', () => {
  let service: HelpService;
  const mockPrisma = {
    user: { findUnique: jest.fn() },
    helpRequest: { create: jest.fn(), update: jest.fn() },
    notificationLog: { create: jest.fn() },
  };
  const mockSms = {
    sendAlertSms: jest.fn(),
  };
  const mockAppleMaps = {
    reverseGeocode: jest.fn(),
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        HelpService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SmsService, useValue: mockSms },
        { provide: AppleMapsService, useValue: mockAppleMaps },
      ],
    }).compile();

    service = mod.get(HelpService);
    jest.clearAllMocks();
    mockSms.sendAlertSms.mockResolvedValue(true);
    mockAppleMaps.reverseGeocode.mockResolvedValue(null);
    mockPrisma.notificationLog.create.mockResolvedValue({});
    mockPrisma.helpRequest.update.mockResolvedValue({});
  });

  it('rejects incomplete coordinate pairs before creating a help request', async () => {
    await expect(service.emergency('u1', { latitude: 39.9 })).rejects.toThrow(
      '经纬度必须同时提供',
    );
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.helpRequest.create).not.toHaveBeenCalled();
  });

  it('persists location metadata and sends a confirmed manual address with a map link', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: '小李',
      address: '北京市朝阳区',
      contacts: [
        { id: 'c1', name: '妈妈', phone: '13800001111', priority: 1 },
        { id: 'c2', name: '爸爸', phone: '13800002222', priority: 2 },
      ],
      subscription: { status: 'active', currentPeriodEnd: new Date(Date.now() + 60_000) },
    });
    mockPrisma.helpRequest.create.mockResolvedValue({
      id: 'hr1',
      createdAt: new Date('2026-06-25T23:00:00Z'),
    });

    const result = await service.emergency('u1', {
      latitude: 39.9,
      longitude: 116.4,
      accuracyMeters: 18.2,
      locationCapturedAt: '2026-07-13T04:30:00.000Z',
      fixSource: 'live',
      precisionAuthorization: 'full',
      addressText: '北京市朝阳区xxx 3号楼401',
      addressSource: 'manual',
      addressConfirmed: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'hr1',
        address: '北京市朝阳区xxx 3号楼401',
        mapUrl: 'https://maps.apple.com/?ll=39.9,116.4',
        accuracyMeters: 18.2,
        deliveryStatus: 'sent',
      }),
    );
    expect(result.contactsNotified).toHaveLength(2);
    expect(mockAppleMaps.reverseGeocode).not.toHaveBeenCalled();
    expect(mockPrisma.helpRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        latitude: 39.9,
        longitude: 116.4,
        accuracyMeters: 18.2,
        locationCapturedAt: new Date('2026-07-13T04:30:00.000Z'),
        fixSource: 'live',
        precisionAuthorization: 'full',
        addressSource: 'manual',
        addressConfirmed: true,
      }),
    });
    expect(mockSms.sendAlertSms).toHaveBeenCalledWith(
      '13800001111',
      expect.stringContaining('地图：https://maps.apple.com/?ll=39.9,116.4'),
    );
    expect(mockSms.sendAlertSms).toHaveBeenCalledWith(
      '13800001111',
      expect.stringContaining('定位误差约±19米'),
    );
  });

  it('uses Apple Maps for unconfirmed coordinates instead of an unmatched home address', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: '小李',
      address: '北京市的家庭住址3号楼401',
      addressLatitude: null,
      addressLongitude: null,
      contacts: [],
    });
    mockPrisma.helpRequest.create.mockResolvedValue({ id: 'hr2', createdAt: new Date() });
    mockAppleMaps.reverseGeocode.mockResolvedValue({
      address: '深圳市南山区腾讯滨海大厦',
      provider: 'apple_maps_server',
    });

    const result = await service.emergency('u1', {
      latitude: 22.533,
      longitude: 113.934,
      addressText: '北京市的家庭住址3号楼401',
      addressSource: 'user_preset',
      addressConfirmed: false,
    });

    expect(result.address).toBe('深圳市南山区腾讯滨海大厦');
    expect(mockAppleMaps.reverseGeocode).toHaveBeenCalledWith(22.533, 113.934);
    expect(mockPrisma.helpRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ addressText: '', addressSource: 'user_preset' }),
    });
    expect(mockPrisma.helpRequest.update).toHaveBeenCalledWith({
      where: { id: 'hr2' },
      data: {
        addressText: '深圳市南山区腾讯滨海大厦',
        addressSource: 'apple_server',
        mapsProvider: 'apple_maps_server',
      },
    });
  });

  it('uses the detailed saved address only when the current fix is within 100 meters', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: '小李',
      address: '北京市朝阳区某小区3号楼2单元401',
      addressLatitude: 39.9,
      addressLongitude: 116.4,
      contacts: [],
    });
    mockPrisma.helpRequest.create.mockResolvedValue({ id: 'hr3', createdAt: new Date() });

    const result = await service.emergency('u1', {
      latitude: 39.9002,
      longitude: 116.4002,
      addressText: '北京市朝阳区某小区3号楼2单元401',
      addressSource: 'user_preset',
    });

    expect(result.address).toBe('北京市朝阳区某小区3号楼2单元401');
    expect(mockAppleMaps.reverseGeocode).not.toHaveBeenCalled();
    expect(mockPrisma.helpRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        addressSource: 'user_preset',
        mapsProvider: 'user',
      }),
    });
  });

  it('sends coordinates without silently falling back to home when geocoding fails', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: '小李',
      address: '错误的家庭住址',
      addressLatitude: 39.9,
      addressLongitude: 116.4,
      contacts: [{ id: 'c1', name: '妈妈', phone: '13800001111', priority: 1 }],
    });
    mockPrisma.helpRequest.create.mockResolvedValue({ id: 'hr4', createdAt: new Date() });

    const result = await service.emergency('u1', {
      latitude: 22.533,
      longitude: 113.934,
      addressText: '错误的家庭住址',
      addressSource: 'user_preset',
    });

    expect(result.address).toBe('');
    expect(mockSms.sendAlertSms).toHaveBeenCalledWith(
      '13800001111',
      expect.stringContaining('https://maps.apple.com/?ll=22.533,113.934'),
    );
    expect(mockSms.sendAlertSms).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('错误的家庭住址'),
    );
  });

  it('reports partial delivery and persists failed SMS attempts', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: '小李',
      address: null,
      contacts: [
        { id: 'c1', name: '妈妈', phone: '13800001111', priority: 1 },
        { id: 'c2', name: '爸爸', phone: '13800002222', priority: 2 },
      ],
      subscription: { status: 'trial', currentPeriodEnd: new Date(Date.now() + 60_000) },
    });
    mockPrisma.helpRequest.create.mockResolvedValue({ id: 'hr5', createdAt: new Date() });
    mockSms.sendAlertSms.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await service.emergency('u1', {
      addressText: 'GPS失败时手动填写的地址',
      addressSource: 'manual',
      addressConfirmed: true,
    });

    expect(result.deliveryStatus).toBe('partial');
    expect(result.contactsNotified.map((contact) => contact.id)).toEqual(['c1']);
    expect(result.contactsFailed.map((contact) => contact.id)).toEqual(['c2']);
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contactId: 'c2', status: 'failed', attempts: 1 }),
    });
  });

  it('only notifies the primary contact after premium expires', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: '小李',
      address: '用户预设地址',
      contacts: [
        { id: 'c1', name: '妈妈', phone: '13800001111', priority: 1 },
        { id: 'c2', name: '爸爸', phone: '13800002222', priority: 2 },
      ],
      subscription: { status: 'expired', currentPeriodEnd: new Date(Date.now() - 60_000) },
    });
    mockPrisma.helpRequest.create.mockResolvedValue({ id: 'hr6', createdAt: new Date() });

    const result = await service.emergency('u1', {});

    expect(result.contactsNotified.map((contact) => contact.id)).toEqual(['c1']);
    expect(mockSms.sendAlertSms).toHaveBeenCalledTimes(1);
    expect(mockSms.sendAlertSms).toHaveBeenCalledWith(
      '13800001111',
      expect.any(String),
    );
  });

  it('falls back to the saved address when no coordinates or address text are available', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      nickname: '小李',
      address: '用户预设地址',
      contacts: [],
    });
    mockPrisma.helpRequest.create.mockResolvedValue({ id: 'hr6', createdAt: new Date() });

    const result = await service.emergency('u1', {});

    expect(result.address).toBe('用户预设地址');
    expect(result.deliveryStatus).toBe('no_contacts');
    expect(mockAppleMaps.reverseGeocode).not.toHaveBeenCalled();
  });

  describe('getAddress', () => {
    it('returns the saved address and its coordinate metadata', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        address: '北京市朝阳区xxx',
        addressLatitude: 39.9,
        addressLongitude: 116.4,
        addressAccuracyMeters: 15,
      });

      await expect(service.getAddress('u1')).resolves.toEqual({
        address: '北京市朝阳区xxx',
        source: 'user_preset',
        latitude: 39.9,
        longitude: 116.4,
        accuracyMeters: 15,
      });
    });
  });

  it('calculates nearby saved-address distance accurately enough for the safety threshold', () => {
    expect(distanceMeters(39.9, 116.4, 39.9002, 116.4002)).toBeLessThan(100);
    expect(distanceMeters(39.9, 116.4, 39.91, 116.41)).toBeGreaterThan(100);
  });
});
