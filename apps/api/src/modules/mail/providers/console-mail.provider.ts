import { Injectable, Logger } from '@nestjs/common';
import type { MailProvider, SendMailInput } from '../mail-provider.interface';

/** Adaptateur de développement : logue l'email au lieu de l'envoyer. */
@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger('Mail');

  async send(input: SendMailInput): Promise<void> {
    this.logger.log(`✉ [DEV] À: ${input.to} — Sujet: ${input.subject}`);
    this.logger.debug(input.html);
  }
}
