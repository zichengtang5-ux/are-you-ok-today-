import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationQueueService } from './notification-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_QUEUE } from './notification.types';

describe('NotificationQueueService', () => {
  let service: NotificationQueueService;
  const mockQueue = { add: jest.fn().mockResolvedValue({}) };
  let logSeq = 0;
  const mockPrisma = {
    notificationLog: {
      create: jest.fn().mockImplementation(() => Promise.resolve({ id: `log${++logSeq}` })),
    },
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationQueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: mockQueue },
      ],
    }).compile();
    service = mod.get(NotificationQueueService);
    jest.clearAllMocks();
    logSeq = 0;
  });

  it('enqueues one sms + one voice job per contact with a pending log each', async () => {
    await service.enqueueAlert({
      contacts: [
        { id: 'c1', phone: '138' },
        { id: 'c2', phone: '139' },
      ],
      alertId: 'a1',
      nickname: '小李',
      lastReplyAt: '从未回复',
      round: 1,
      includeVoice: true,
    });

    // 2 contacts × 2 channels = 4 logs + 4 jobs
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(4);
    expect(mockQueue.add).toHaveBeenCalledTimes(4);

    // pending 状态预创建
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactId: 'c1', channel: 'sms', round: 1, status: 'pending' }),
      }),
    );
    // 任务携带 logId 与渠道
    expect(mockQueue.add).toHaveBeenCalledWith(
      'sms',
      expect.objectContaining({ channel: 'sms', phone: '138', logId: expect.any(String) }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'voice_call',
      expect.objectContaining({ channel: 'voice_call', phone: '139', nickname: '小李' }),
    );
  });

  it('passes round through to logs (round 2 for repeat alerts)', async () => {
    await service.enqueueAlert({
      contacts: [{ id: 'c1', phone: '138' }],
      alertId: 'a1',
      nickname: '小李',
      lastReplyAt: '从未回复',
      round: 2,
      includeVoice: false,
    });
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ round: 2 }) }),
    );
    expect(mockQueue.add).not.toHaveBeenCalledWith(
      'voice_call',
      expect.anything(),
    );
  });
});
