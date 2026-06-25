import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ContactService', () => {
  let service: ContactService;
  const mockPrisma = {
    emergencyContact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    verificationCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
    },
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

  describe('create', () => {
    it('should create contact for free user with 0 contacts', async () => {
      mockPrisma.emergencyContact.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.emergencyContact.create.mockResolvedValue({ id: 'c1', name: '妈妈' });

      const result = await service.create('u1', { name: '妈妈', phone: '13800001111' });
      expect(result).toEqual({ id: 'c1', name: '妈妈' });
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
});
