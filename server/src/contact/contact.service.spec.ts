import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ContactService', () => {
  let service: ContactService;
  const mockPrisma: any = {
    emergencyContact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    verificationCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (arg: unknown): Promise<unknown> => {
      if (typeof arg === 'function') {
        return (arg as (tx: any) => unknown)(mockPrisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };

  const mockSms = { sendVerificationCode: jest.fn().mockResolvedValue(true) };
  const mockConfig = { get: jest.fn((_k: string, d?: string) => d ?? '') };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SmsService, useValue: mockSms },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = mod.get(ContactService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    const contacts = [
      { id: 'c1', priority: 1 },
      { id: 'c2', priority: 2 },
    ];

    it('only exposes the primary contact to free or expired users', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue(contacts);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        status: 'active',
        currentPeriodEnd: new Date(Date.now() - 1000),
      });

      await expect(service.list('u1')).resolves.toEqual([contacts[0]]);
    });

    it('exposes up to five contacts to premium users', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue(contacts);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 60_000),
      });

      await expect(service.list('u1')).resolves.toEqual(contacts);
    });
  });

  describe('create', () => {
    it('should create contact for free user with 0 contacts', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.emergencyContact.create.mockResolvedValue({ id: 'c1', name: '妈妈' });

	      const result = await service.create('u1', { name: '妈妈', phone: '13800001111' });
	      expect(result).toEqual({ id: 'c1', name: '妈妈' });
      expect(mockPrisma.emergencyContact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ verified: true }),
      });
	    });

    it('should reject free user adding 2nd contact', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.create('u1', { name: '爸爸', phone: '13800002222' })).rejects.toThrow(BadRequestException);
    });

    it('should allow premium user to add more contacts', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active' });
      mockPrisma.emergencyContact.create.mockResolvedValue({ id: 'c2' });

      const result = await service.create('u1', { name: '爸爸', phone: '13800002222' });
      expect(result).toEqual({ id: 'c2' });
    });

    it('should treat an expired active subscription as free', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue([{ id: 'c1' }]);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        status: 'active',
        currentPeriodEnd: new Date(Date.now() - 1000),
      });

      await expect(
        service.create('u1', { name: '爸爸', phone: '13800002222' }),
      ).rejects.toThrow('免费版最多添加 1 个联系人');
    });

    it('should reject a duplicated contact phone', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue([
        { id: 'c1', phone: '13800001111' },
      ]);
      mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active' });

      await expect(
        service.create('u1', { name: '妈妈', phone: '13800001111' }),
      ).rejects.toThrow('该手机号已是紧急联系人');
    });
  });

  describe('update', () => {
    it('should reject changing a contact to a duplicated phone', async () => {
      mockPrisma.emergencyContact.findUnique.mockResolvedValue({
        id: 'c2',
        userId: 'u1',
        phone: '13800002222',
      });
      mockPrisma.emergencyContact.findFirst.mockResolvedValue({ id: 'c1' });

      await expect(
        service.update('u1', 'c2', { phone: '13800001111' }),
      ).rejects.toThrow('该手机号已是紧急联系人');
    });
  });

  describe('remove', () => {
    it('should reject deleting last contact', async () => {
      mockPrisma.emergencyContact.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      mockPrisma.emergencyContact.findMany.mockResolvedValue([{ id: 'c1' }]);

      await expect(service.remove('u1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should reject deleting another user contact', async () => {
      mockPrisma.emergencyContact.findUnique.mockResolvedValue({ id: 'c1', userId: 'u2' });

      await expect(service.remove('u1', 'c1')).rejects.toThrow(ForbiddenException);
    });

    it('should delete contact when user has more than 1', async () => {
      mockPrisma.emergencyContact.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      mockPrisma.emergencyContact.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      mockPrisma.emergencyContact.delete.mockResolvedValue({});

      const result = await service.remove('u1', 'c1');
      expect(result.message).toBe('联系人已删除');
    });
  });

  describe('verify', () => {
    it('should verify contact with correct code', async () => {
      mockPrisma.emergencyContact.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', phone: '13800001111' });
      mockPrisma.verificationCode.findFirst.mockResolvedValue({ id: 'vc1', code: '123456' });
      mockPrisma.verificationCode.update.mockResolvedValue({});
      mockPrisma.emergencyContact.update.mockResolvedValue({ id: 'c1', verified: true });

      const result = await service.verify('u1', 'c1', '123456');
      expect(result.contact.verified).toBe(true);
    });

    it('should reject wrong verification code', async () => {
      mockPrisma.emergencyContact.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1', phone: '13800001111' });
      mockPrisma.verificationCode.findFirst.mockResolvedValue(null);

      await expect(service.verify('u1', 'c1', '000000')).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendVerificationCode', () => {
    it('should report an SMS provider failure', async () => {
      mockPrisma.emergencyContact.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        phone: '13800001111',
      });
      mockPrisma.verificationCode.findFirst.mockResolvedValue(null);
      mockPrisma.verificationCode.create.mockResolvedValue({ id: 'vc1' });
      mockPrisma.verificationCode.delete.mockResolvedValue({});
      mockSms.sendVerificationCode.mockResolvedValueOnce(false);

      await expect(service.sendVerificationCode('u1', 'c1')).rejects.toThrow('验证码发送失败');
      expect(mockPrisma.verificationCode.delete).toHaveBeenCalledWith({ where: { id: 'vc1' } });
    });
  });

  describe('reorder', () => {
    it('updates priorities in the requested order', async () => {
      mockPrisma.emergencyContact.findMany
        .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }])
        .mockResolvedValueOnce([
          { id: 'c2', priority: 1 },
          { id: 'c1', priority: 2 },
        ]);
      mockPrisma.emergencyContact.update.mockResolvedValue({});
      mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active' });

      const result = await service.reorder('u1', ['c2', 'c1']);

      expect(mockPrisma.emergencyContact.update).toHaveBeenCalledWith({
        where: { id: 'c2' },
        data: { priority: 1 },
      });
      expect(mockPrisma.emergencyContact.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { priority: 2 },
      });
      expect(result).toEqual([
        { id: 'c2', priority: 1 },
        { id: 'c1', priority: 2 },
      ]);
    });

    it('rejects incomplete or duplicated ids', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);

      await expect(service.reorder('u1', ['c1'])).rejects.toThrow(BadRequestException);
      await expect(service.reorder('u1', ['c1', 'c1'])).rejects.toThrow(BadRequestException);
    });

    it('rejects contacts owned by another user', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);

      await expect(service.reorder('u1', ['c1', 'c3'])).rejects.toThrow(ForbiddenException);
    });
  });
});
