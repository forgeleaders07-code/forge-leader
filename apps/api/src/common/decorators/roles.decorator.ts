import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restreint une route aux rôles listés (en plus du JWT). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
