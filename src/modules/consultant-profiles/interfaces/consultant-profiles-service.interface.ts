import { OnboardConsultantProfileDto, UpdateConsultantProfileDto } from '../dto/requests';
import { ConsultantProfileResponseDto } from '../dto/responses';

export interface IConsultantProfilesService {
  getProfile(): Promise<ConsultantProfileResponseDto>;
  onboard(dto: OnboardConsultantProfileDto): Promise<ConsultantProfileResponseDto>;
  updateProfile(dto: UpdateConsultantProfileDto): Promise<ConsultantProfileResponseDto>;
  verify(profileId: string): Promise<void>;
}
