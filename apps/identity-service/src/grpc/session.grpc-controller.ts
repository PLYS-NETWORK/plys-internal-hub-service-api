import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';

interface IValidateSessionRequest {
  sessionId?: string;
  deviceId?: string;
}

interface IValidateSessionResponse {
  valid: boolean;
  userId: string;
  email: string;
  role: string;
  activePlatform: string;
  businessId?: string;
  timezone?: string;
}

@Controller()
export class SessionGrpcController {
  constructor(private readonly uow: UnitOfWorkService) {}

  @GrpcMethod('IdentityService', 'ValidateSession')
  public async validateSession(
    request: IValidateSessionRequest,
  ): Promise<IValidateSessionResponse> {
    const sessionId = request.sessionId ?? '';
    if (!sessionId) {
      return this.invalid();
    }

    const session = await this.uow.userSessions.findByActiveId(sessionId);
    if (!session || session.usedAt !== null || session.expiresAt < new Date()) {
      return this.invalid();
    }

    const user = await this.uow.users.findByActiveId(session.userId);
    if (!user || !user.isActive) {
      return this.invalid();
    }

    let businessId: string | undefined;
    if (user.platform === ActivePlatform.BUSINESS) {
      const profile = await this.uow.businessProfiles.findByUserId(user.id);
      businessId = profile?.id;
    }

    return {
      valid: true,
      userId: user.id,
      email: user.email,
      role: String(user.role),
      activePlatform: String(user.platform),
      businessId,
      timezone: session.timezone ?? undefined,
    };
  }

  private invalid(): IValidateSessionResponse {
    return {
      valid: false,
      userId: '',
      email: '',
      role: '',
      activePlatform: '',
    };
  }
}
