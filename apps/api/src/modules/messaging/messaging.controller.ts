import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ContactsQueryDto, OpenConversationDto, SendMessageDto } from './dto/messaging.dto';
import { MessagingService } from './messaging.service';

@Controller('messages')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('contacts')
  contacts(@CurrentUser() user: AuthenticatedUser, @Query() q: ContactsQueryDto) {
    return this.messaging.searchContacts(user.id, q.query);
  }

  @Get('conversations')
  conversations(@CurrentUser() user: AuthenticatedUser) {
    return this.messaging.listConversations(user.id);
  }

  @Post('conversations')
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenConversationDto) {
    return this.messaging.openConversation(user.id, dto.recipientId);
  }

  @Get('conversations/:id')
  thread(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.messaging.getThread(user.id, id);
  }

  // Anti-spam : 30 messages / minute
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.sendMessage(user.id, id, dto.content);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: AuthenticatedUser) {
    return this.messaging.unreadCount(user.id);
  }
}
