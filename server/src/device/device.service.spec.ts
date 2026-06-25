import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceService', () => {
  let service: DeviceService;
  const mockPrisma = {
    device: {
      upsert: jest.fn(),
      findMany: jest.fn(),
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
    it('should upsert device and return success message', async () => {
      mockPrisma.device.upsert.mockResolvedValue({ id: 'd1', userId: 'u1', token: 'tok1', platform: 'ios' });

      const result = await service.registerDevice('u1', 'tok1', 'ios');
      expect(result.message).toBe('设备已注册');
      expect(mockPrisma.device.upsert).toHaveBeenCalledWith({
        where: { userId_token: { userId: 'u1', token: 'tok1' } },
        update: { platform: 'ios' },
        create: { userId: 'u1', token: 'tok1', platform: 'ios' },
      });
    });

    it('should update platform on existing token', async () => {
      mockPrisma.device.upsert.mockResolvedValue({ id: 'd1', userId: 'u1', token: 'tok1', platform: 'android' });

      const result = await service.registerDevice('u1', 'tok1', 'android');
      expect(result.message).toBe('设备已注册');
      expect(mockPrisma.device.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { platform: 'android' },
        }),
      );
    });
  });

  describe('getDevicesByUserId', () => {
    it('should return user devices', async () => {
      const devices = [
        { id: 'd1', token: 'tok1', platform: 'ios' },
        { id: 'd2', token: 'tok2', platform: 'ios' },
      ];
      mockPrisma.device.findMany.mockResolvedValue(devices);

      const result = await service.getDevicesByUserId('u1');
      expect(result).toHaveLength(2);
      expect(mockPrisma.device.findMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('should return empty array for user with no devices', async () => {
      mockPrisma.device.findMany.mockResolvedValue([]);

      const result = await service.getDevicesByUserId('u1');
      expect(result).toHaveLength(0);
    });
  });
});
