import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Ouvre explicitement une route : par défaut, tout est protégé par JWT. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
