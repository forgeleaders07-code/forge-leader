import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CommunityService } from './community.service';
import { CreateCommentDto, CreatePostDto, FeedQueryDto, ReactDto } from './dto/community.dto';

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('feed')
  feed(@CurrentUser() user: AuthenticatedUser, @Query() query: FeedQueryDto) {
    return this.community.getFeed(user.id, query.cursor, query.limit ?? 20);
  }

  // Anti-spam : 10 publications / minute maximum
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('posts')
  createPost(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePostDto) {
    return this.community.createPost(user.id, dto.content);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('posts/:id')
  async deletePost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.community.deletePost(user, id);
  }

  @Get('posts/:id/comments')
  comments(@Param('id') id: string) {
    return this.community.listComments(id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('posts/:id/comments')
  createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.community.createComment(user.id, id, dto.content);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('comments/:id')
  async deleteComment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.community.deleteComment(user, id);
  }

  @Put('posts/:id/reaction')
  react(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ) {
    return this.community.react(user.id, id, dto.type);
  }
}
