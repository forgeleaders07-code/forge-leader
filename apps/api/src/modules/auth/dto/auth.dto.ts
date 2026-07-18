import { IsEmail, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

/**
 * Activation d'un compte provisionné par webhook :
 * l'apprenant définit son mot de passe via le lien reçu par email.
 */
export class ActivateAccountDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir une minuscule, une majuscule et un chiffre',
  })
  password!: string;
}
