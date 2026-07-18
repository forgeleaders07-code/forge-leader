import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class OpenConversationDto {
  @IsUUID()
  recipientId!: string;
}

export class SendMessageDto {
  @trim()
  @IsString()
  @MinLength(1, { message: 'Le message ne peut pas être vide' })
  @MaxLength(4000)
  content!: string;
}

export class ContactsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}
