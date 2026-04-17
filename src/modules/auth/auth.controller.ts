import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register  → @Public()
  // POST /auth/login     → @Public()
  // POST /auth/refresh   → @Public() (uses RefreshTokenGuard)
  // POST /auth/logout    → authenticated
  // GET  /auth/me        → authenticated
}
