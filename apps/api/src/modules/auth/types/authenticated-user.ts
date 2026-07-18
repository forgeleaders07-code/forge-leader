import { UserRole } from '@prisma/client';

/** Utilisateur tel qu'attaché à la requête après validation du JWT. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/** Payload signé dans l'access token. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}
