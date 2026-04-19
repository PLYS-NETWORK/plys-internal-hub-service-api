import { OnboardBusinessProfileDto } from '../dto/requests/onboard-business-profile.dto';
import { UpdateBusinessProfileDto } from '../dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from '../dto/responses/business-profile-response.dto';

export interface IBusinessProfilesService {
  getProfile(): Promise<BusinessProfileResponseDto>;
  onboard(dto: OnboardBusinessProfileDto): Promise<BusinessProfileResponseDto>;
  updateProfile(dto: UpdateBusinessProfileDto): Promise<BusinessProfileResponseDto>;
  markAsPartner(profileId: string): Promise<void>;
  allowPaymentCredit(profileId: string): Promise<void>;
}
