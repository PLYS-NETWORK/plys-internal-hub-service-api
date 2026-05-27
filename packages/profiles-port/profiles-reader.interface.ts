export interface IBusinessProfileSnapshot {
  id: string;
  userId: string;
  companyName: string;
  accountBalance: string;
  allowPaymentCredit: boolean;
  commissionRate: string;
  isPartnerPlatform: boolean;
}

export interface IConsultantProfileSnapshot {
  id: string;
  userId: string;
  fullName: string;
}

export interface IConsultantSkillSnapshot {
  consultantId: string;
  skillId: string;
  skillName: string;
  proficiencyLevel: string | null;
  rating: string | null;
}

export interface IProfilesReader {
  findBusinessByUserAndId(
    userId: string,
    businessId: string,
  ): Promise<IBusinessProfileSnapshot | null>;
  findConsultantByUserId(userId: string): Promise<IConsultantProfileSnapshot | null>;
  findBusinessById(id: string): Promise<IBusinessProfileSnapshot | null>;
  findConsultantById(id: string): Promise<IConsultantProfileSnapshot | null>;
  findConsultantSkills(consultantId: string): Promise<IConsultantSkillSnapshot[]>;
  findConsultantSkillsByIds(consultantIds: string[]): Promise<IConsultantSkillSnapshot[]>;
  countSkillMatchForProject(consultantId: string, projectId: string): Promise<number>;
}
