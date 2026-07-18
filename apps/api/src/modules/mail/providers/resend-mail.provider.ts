import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { MailProvider, SendMailInput } from '../mail-provider.interface';

@Injectable()
export class ResendMailProvider implements MailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.client = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.from =
      config.get<string>('MAIL_FROM') ??
      'La Forge des Leaders <no-reply@laforgedesleaders.com>';
  }

  async send(input: SendMailInput): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (error) {
      throw new Error(`Échec d'envoi email via Resend : ${error.message}`);
    }
  }
}
