import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Profil de l'utilisateur connecté. */
  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.users.findById(current.id);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
