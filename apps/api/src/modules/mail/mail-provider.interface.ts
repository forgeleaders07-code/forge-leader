/**
 * Abstraction d'envoi d'emails : Resend aujourd'hui, Amazon SES demain,
 * sans toucher au code métier. Injectée via le token MAIL_PROVIDER.
 */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

export interface MailProvider {
  send(input: SendMailInput): Promise<void>;
}
