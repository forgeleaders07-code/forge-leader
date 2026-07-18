import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_PROVIDER } from './mail-provider.interface';
import { MailService } from './mail.service';
import { ConsoleMailProvider } from './providers/console-mail.provider';
import { ResendMailProvider } from './providers/resend-mail.provider';

/**
 * Sélection de l'adaptateur au démarrage :
 * RESEND_API_KEY présent → Resend ; sinon → console (développement).
 */
@Global()
@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('RESEND_API_KEY')
          ? new ResendMailProvider(config)
          : new ConsoleMailProvider(),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
