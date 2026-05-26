import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_INTERACTIVE } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { ListNotificationsDto } from './dto/requests';
import {
  MarkAllReadResponseDto,
  NotificationCursorPageDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from './dto/responses';
import { NotificationsService } from './services/notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(RolesGuard)
@Roles(UserRole.USER, UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_INTERACTIVE)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List my notifications (cursor-paginated)' })
  public async listMine(
    @Query() dto: ListNotificationsDto,
  ): Promise<ITranslatedPayload<NotificationCursorPageDto>> {
    const data = await this.notificationsService.listMine(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('me/unread-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get my unread-count (Redis-cached)' })
  public async unreadCount(): Promise<ITranslatedPayload<UnreadCountResponseDto>> {
    const data = await this.notificationsService.getUnreadCount();
    return { messageKey: 'success.ok', data };
  }

  @Patch('me/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one notification as read (idempotent)' })
  public async markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ITranslatedPayload<NotificationResponseDto>> {
    const data = await this.notificationsService.markRead(id);
    return { messageKey: 'success.notification.read', data };
  }

  @Patch('me/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark every unread notification as read' })
  public async markAllRead(): Promise<ITranslatedPayload<MarkAllReadResponseDto>> {
    const data = await this.notificationsService.markAllRead();
    return { messageKey: 'success.notification.read_all', data };
  }
}
