import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlertService } from './alert.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

describe('AlertService', () => {
  let service: AlertService;
  let mockPrisma: any;
  const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    mockPrisma = {
      alertEvent: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      emergencyContact: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      alertAction: {
        create: jest.fn(),
      },
      guardStatus: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      dailyRecord: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown): Promise<unknown> => {
        if (typeof arg === 'function') {
          return (arg as (tx: unknown) => unknown)(mockPrisma);
        }
        return arg;
      }),
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsService, useValue: mockEvents },
      ],
    }).compile();

    service = mod.get(AlertService);
    jest.clearAllMocks();
  });

  it('returns active alert with masked contacts and sms round count', async () => {
    mockPrisma.alertEvent.findFirst.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      triggeredAt: new Date('2026-07-03T10:00:00Z'),
      contactsNotified: '["c1"]',
      timeline: '[{"time":"22:30","action":"通知联系人"}]',
      smsRounds: 2,
      guardStatus: { lastReplyAt: new Date('2026-07-02T12:00:00Z') },
    });
    mockPrisma.emergencyContact.findMany.mockResolvedValue([
      { id: 'c1', name: '妈妈', phone: '13812345678' },
      { id: 'c2', name: '爸爸', phone: '13912345678' },
    ]);

    const result = await service.getActiveAlert('u1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'a1',
        smsRounds: 2,
        contactsNotified: [{ id: 'c1', name: '妈妈', phone: '138****5678' }],
      }),
    );
  });

  it('confirms safety, resolves alert, and records today as replied', async () => {
    mockPrisma.alertEvent.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: 'active',
      timeline: '[]',
    });
    mockPrisma.user.findUnique.mockResolvedValue({ phone: '13900001111' });
    mockPrisma.emergencyContact.findUnique.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      name: '妈妈',
      phone: '13900001111',
    });

    const result = await service.confirm('u1', 'a1', 'c1');

    expect(result.alert.status).toBe('confirmed');
    expect(mockPrisma.alertAction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'confirmed' }) }),
    );
    expect(mockPrisma.alertEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'confirmed' }) }),
    );
    expect(mockPrisma.dailyRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'replied', replyMethod: 'contact_confirm' }),
      }),
    );
    expect(mockEvents.publish).toHaveBeenCalledWith({ userId: 'u1', type: 'alert_resolved' });
  });

  it('records need-help action and returns suggested actions', async () => {
    mockPrisma.alertEvent.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: 'active',
      timeline: '[]',
    });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ phone: '13900001111' })
      .mockResolvedValueOnce({ phone: '13800001111', address: '上海市测试路' });
    mockPrisma.emergencyContact.findUnique.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      name: '妈妈',
      phone: '13900001111',
    });
    mockPrisma.emergencyContact.findMany.mockResolvedValue([
      { id: 'c1', name: '妈妈', phone: '13900001111' },
      { id: 'c2', name: '爸爸', phone: '13700002222' },
    ]);

    const result = await service.needHelp('u1', 'a1', 'c1');

    expect(result.alert.status).toBe('help_needed');
    expect(mockPrisma.alertAction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'help_needed' }) }),
    );
    expect(result.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'call_user' }),
        expect.objectContaining({ type: 'call_120', address: '上海市测试路' }),
        expect.objectContaining({ type: 'call_contact' }),
      ]),
    );
  });

  it('rejects processing an already handled alert', async () => {
    mockPrisma.alertEvent.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', status: 'confirmed' });

    await expect(service.confirm('u1', 'a1', 'c1')).rejects.toThrow(BadRequestException);
  });

  it('rejects a contact that does not belong to the alert owner', async () => {
    mockPrisma.alertEvent.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: 'active',
      timeline: '[]',
    });
    mockPrisma.user.findUnique.mockResolvedValue({ phone: '13900001111' });
    mockPrisma.emergencyContact.findUnique.mockResolvedValue({ id: 'c1', userId: 'u2' });

    await expect(service.confirm('u1', 'a1', 'c1')).rejects.toThrow(ForbiddenException);
  });
});
