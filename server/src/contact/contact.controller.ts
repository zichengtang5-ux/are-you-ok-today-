import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { VerifyContactDto } from './dto/verify-contact.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('紧急联系人')
@ApiBearerAuth()
@Controller('contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @ApiOperation({ summary: '获取联系人列表' })
  async list(@CurrentUser('id') userId: string) {
    return this.contactService.list(userId);
  }

  @Post()
  @ApiOperation({ summary: '创建联系人' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateContactDto) {
    return this.contactService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新联系人' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除联系人' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.contactService.remove(userId, id);
  }

  @Put('reorder')
  @ApiOperation({ summary: '调整联系人优先级' })
  async reorder(@CurrentUser('id') userId: string, @Body() body: { ids: string[] }) {
    return this.contactService.reorder(userId, body.ids);
  }

  @Post(':id/send-code')
  @HttpCode(200)
  @ApiOperation({ summary: '发送联系人验证短信' })
  async sendCode(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.contactService.sendVerificationCode(userId, id);
  }

  @Post(':id/verify')
  @HttpCode(200)
  @ApiOperation({ summary: '验证联系人手机号' })
  async verify(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: VerifyContactDto,
  ) {
    return this.contactService.verify(userId, id, dto.code);
  }
}
