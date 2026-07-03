import { Test, TestingModule } from '@nestjs/testing';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';

describe('AlertController', () => {
  let controller: AlertController;
  const mockAlertService = {
    getActiveAlert: jest.fn(),
    getAlert: jest.fn(),
    confirm: jest.fn(),
    needHelp: jest.fn(),
  };

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [{ provide: AlertService, useValue: mockAlertService }],
    }).compile();

    controller = mod.get(AlertController);
    jest.clearAllMocks();
  });

  it('delegates active alert lookup to service', async () => {
    mockAlertService.getActiveAlert.mockResolvedValue(null);
    await expect(controller.getActiveAlert('u1')).resolves.toBeNull();
    expect(mockAlertService.getActiveAlert).toHaveBeenCalledWith('u1');
  });

  it('delegates alert detail lookup with contactId', async () => {
    mockAlertService.getAlert.mockResolvedValue({ id: 'a1' });
    await expect(controller.getAlert('u1', 'a1', 'c1')).resolves.toEqual({ id: 'a1' });
    expect(mockAlertService.getAlert).toHaveBeenCalledWith('u1', 'a1', 'c1');
  });

  it('delegates confirm action to service', async () => {
    mockAlertService.confirm.mockResolvedValue({ message: 'ok' });
    await expect(controller.confirm('u1', 'a1', { contactId: 'c1' })).resolves.toEqual({ message: 'ok' });
    expect(mockAlertService.confirm).toHaveBeenCalledWith('u1', 'a1', 'c1');
  });

  it('delegates need-help action to service', async () => {
    mockAlertService.needHelp.mockResolvedValue({ message: 'ok' });
    await expect(controller.needHelp('u1', 'a1', { contactId: 'c1' })).resolves.toEqual({ message: 'ok' });
    expect(mockAlertService.needHelp).toHaveBeenCalledWith('u1', 'a1', 'c1');
  });
});
