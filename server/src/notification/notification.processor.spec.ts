import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { NotificationProcessor } from './notification.processor';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { VoiceService } from '../voice/voice.service';
import { NotificationJob } from './notification.types';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  const mockPrisma = {
    notificationLog: { update: jest.fn().mockResolvedValue({}) },
  };
  const mockSms = { sendAlertSms: jest.fn() };
  const mockVoice = { sendAlertVoice: jest.fn() };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SmsService, useValue: mockSms },
        { provide: VoiceService, useValue: mockVoice },
      ],
    }).compile();
    processor = mod.get(NotificationProcessor);
    jest.clearAllMocks();
    mockPrisma.notificationLog.update.mockResolvedValue({});
  });

  function smsJob(): Job<NotificationJob> {
    return {
      data: { logId: 'log1', channel: 'sms', phone: '13800001111', message: 'hi' },
    } as Job<NotificationJob>;
  }

  it('marks log sent on successful sms delivery', async () => {
    mockSms.sendAlertSms.mockResolvedValue(true);
    await processor.process(smsJob());

    expect(mockSms.sendAlertSms).toHaveBeenCalledWith('13800001111', 'hi');
    // 第一次 update 增加 attempts，第二次写 sent
    expect(mockPrisma.notificationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'log1' }, data: { attempts: { increment: 1 } } }),
    );
    expect(mockPrisma.notificationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'log1' }, data: expect.objectContaining({ status: 'sent' }) }),
    );
  });

  it('throws on failed delivery to trigger BullMQ retry', async () => {
    mockSms.sendAlertSms.mockResolvedValue(false);
    await expect(processor.process(smsJob())).rejects.toThrow(/Delivery failed/);
    // 不应写 sent
    expect(mockPrisma.notificationLog.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }),
    );
  });

  it('routes voice_call jobs to VoiceService', async () => {
    mockVoice.sendAlertVoice.mockResolvedValue(true);
    const job = {
      data: { logId: 'log2', channel: 'voice_call', phone: '139', nickname: '李', lastReplyAt: '昨天' },
    } as Job<NotificationJob>;
    await processor.process(job);
    expect(mockVoice.sendAlertVoice).toHaveBeenCalledWith('139', '李', '昨天');
  });

  it('does not dead-letter while retries remain', async () => {
    const job = {
      data: { logId: 'log1', channel: 'sms', phone: '138' },
      attemptsMade: 2,
      opts: { attempts: 5 },
    } as Job<NotificationJob>;
    await processor.onFailed(job, new Error('timeout'));
    expect(mockPrisma.notificationLog.update).not.toHaveBeenCalled();
  });

  it('dead-letters and records failReason when retries exhausted', async () => {
    const job = {
      data: { logId: 'log1', channel: 'sms', phone: '138' },
      attemptsMade: 5,
      opts: { attempts: 5 },
    } as Job<NotificationJob>;
    await processor.onFailed(job, new Error('permanent failure'));
    expect(mockPrisma.notificationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log1' },
        data: expect.objectContaining({ status: 'failed', failReason: 'permanent failure' }),
      }),
    );
  });
});
