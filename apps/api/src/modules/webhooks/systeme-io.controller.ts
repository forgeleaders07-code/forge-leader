import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { SystemeIoWebhookService } from './systeme-io.service';

/**
 * Réception des webhooks Systeme.io.
 * Sécurité : signature HMAC-SHA256 du corps avec le secret partagé
 * (en-tête x-webhook-signature), comparaison en temps constant.
 */
@Controller('webhooks/systeme-io')
export class SystemeIoWebhookController {
  constructor(
    private readonly service: SystemeIoWebhookService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post()
  async handle(
    @Body() payload: Record<string, unknown>,
    @Headers('x-webhook-signature') signature?: string,
  ): Promise<{ status: string }> {
    this.verifySignature(JSON.stringify(payload), signature);
    const result = await this.service.process(payload);
    // Toujours 200 une fois l'événement journalisé : Systeme.io ne doit pas
    // rejouer un événement qu'on a déjà enregistré (le retraitement est interne).
    return { status: result };
  }

  private verifySignature(rawBody: string, signature?: string): void {
    if (!signature) {
      throw new UnauthorizedException('Signature manquante');
    }
    const secret = this.config.getOrThrow<string>('SYSTEME_IO_WEBHOOK_SECRET');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Signature invalide');
    }
  }
}
