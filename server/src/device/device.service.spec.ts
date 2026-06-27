import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceService', () => {
  let service: DeviceService;
  const mockPrisma = {
    device: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = mod.get(DeviceService);
    jest.clearAllMocks();
  });

  describe('registerDevice', () => {
    it('should delete old tokens and upsert new device', async () => {
      mockPrisma.device.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.device.upsert.mockResolvedValue({ id: 'd1', userId: 'u1', token: 'new-token', platform: 'ios' });

      const result = await service.registerDevice('u1', 'new-token', 'ios');

      expect(result.message).toBe('设备已注册');
      expect(mockPrisma.device.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', token: { not: 'new-token' } },
      });
      expect(mockPrisma.device.upsert).toHaveBeenCalledWith({
        where: { userId_token: { userId: 'u1', token: 'new-token' } },
        update: { platform: 'ios' },
        create: { userId: 'u1', token: 'new-token', platform: 'ios' },
      });
    });

    it('should not delete the same token being registered', async () => {
      mockPrisma.device.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.device.upsert.mockResolvedValue({ id: 'd1', userId: 'u1', token: 'same-token', platform: 'ios' });

      await service.registerDevice('u1', 'same-token', 'ios');

      expect(mockPrisma.device.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', token: { not: 'same-token' } },
      });
    });
  });

  describe('getDevicesByUserId', () => {
    it('should return user devices', async () => {
      const devices = [
        { id: 'd1', token: 'tok1', platform: 'ios' },
      ];
      mockPrisma.device.findMany.mockResolvedValue(devices);

      const result = await service.getDevicesByUserId('u1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('should return empty array for user with no devices', async () => {
      mockPrisma.device.findMany.mockResolvedValue([]);

      const result = await service.getDevicesByUserId('u1');
      expect(result).toHaveLength(0);
    });
  });
});
