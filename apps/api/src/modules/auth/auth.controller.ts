import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ActivateAccountDto, LoginDto, LogoutDto, RefreshDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // anti brute-force ciblé
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, {
      userAgent: req.headers['user-agent'],
      ip,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ip,
    });
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('activate')
  activate(@Body() dto: ActivateAccountDto) {
    return this.auth.activateAccount(dto.userId, dto.token, dto.password);
  }
}
