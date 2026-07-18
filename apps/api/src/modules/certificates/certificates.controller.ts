import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CertificatesService } from './certificates.service';

class ClaimCertificateDto {
  @IsUUID()
  courseId!: string;
}

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @HttpCode(HttpStatus.OK)
  @Post('claim')
  claim(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClaimCertificateDto) {
    return this.certificates.claim(user.id, dto.courseId);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.certificates.listMine(user.id);
  }

  @Get('mine/:code')
  mineByCode(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.certificates.getMineByCode(user.id, code);
  }

  /** Vérification publique — imprimée sur chaque certificat. */
  @Public()
  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.certificates.verify(code);
  }
}
