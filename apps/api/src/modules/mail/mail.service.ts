import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_PROVIDER, MailProvider } from './mail-provider.interface';

@Injectable()
export class MailService {
  private readonly frontendUrl: string;

  constructor(
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  /** Email d'accueil après provisioning : lien de définition du mot de passe. */
  async sendWelcomeEmail(input: {
    to: string;
    firstName: string;
    courseTitle: string;
    userId: string;
    activationToken: string;
  }): Promise<void> {
    const activationUrl = `${this.frontendUrl}/activation?userId=${encodeURIComponent(
      input.userId,
    )}&token=${encodeURIComponent(input.activationToken)}`;

    await this.provider.send({
      to: input.to,
      subject: `Bienvenue à La Forge des Leaders — votre accès à « ${input.courseTitle} »`,
      html: this.welcomeTemplate(input.firstName, input.courseTitle, activationUrl),
    });
  }

  /** Accès ajouté à un compte existant. */
  async sendCourseAddedEmail(input: {
    to: string;
    firstName: string;
    courseTitle: string;
  }): Promise<void> {
    await this.provider.send({
      to: input.to,
      subject: `Nouvelle formation débloquée : « ${input.courseTitle} »`,
      html: `
        <p>Bonjour ${input.firstName},</p>
        <p>Votre formation <strong>${input.courseTitle}</strong> est disponible dès maintenant
        dans votre espace membre.</p>
        <p><a href="${this.frontendUrl}/connexion">Accéder à mon campus</a></p>
        <p>— L'équipe La Forge des Leaders</p>`,
    });
  }

  private welcomeTemplate(firstName: string, courseTitle: string, activationUrl: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <h2>Bienvenue à La Forge des Leaders 🔥</h2>
        <p>Bonjour ${firstName},</p>
        <p>Votre formation <strong>${courseTitle}</strong> vous attend dans votre campus privé.</p>
        <p>Pour activer votre compte, définissez votre mot de passe (lien valable 7 jours) :</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${activationUrl}"
             style="background:#111;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none">
            Activer mon compte
          </a>
        </p>
        <p style="color:#666;font-size:13px">Si vous n'êtes pas à l'origine de cet achat,
        ignorez simplement cet email.</p>
        <p>— L'équipe La Forge des Leaders</p>
      </div>`;
  }
}
