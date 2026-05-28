import { Injectable } from '@nestjs/common';
import { BusinessProfile, ConsultantProfile } from '@plys/libraries/database/entities';
import {
  IBusinessProfileLock,
  IBusinessProfileSnapshot,
  IConsultantProfileSnapshot,
  IConsultantSkillSnapshot,
  IProfilesLedger,
  IProfilesReader,
  ProfilesTx,
} from '@plys/libraries/profiles-port';
import { IUnitOfWork } from '@plys/libraries/unit-of-work/interfaces/unit-of-work.interface';
import {
  BusinessProfileRepository,
  ConsultantProfileRepository,
  ConsultantSkillRepository,
} from '@plys/libraries/unit-of-work/repositories';

function toBusinessSnapshot(profile: BusinessProfile): IBusinessProfileSnapshot {
  return {
    id: profile.id,
    userId: profile.userId,
    companyName: profile.companyName,
    accountBalance: profile.accountBalance,
    allowPaymentCredit: profile.allowPaymentCredit,
    commissionRate: profile.commissionRate,
    isPartnerPlatform: profile.isPartnerPlatform,
  };
}

function toConsultantSnapshot(profile: ConsultantProfile): IConsultantProfileSnapshot {
  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
  };
}

function toBusinessLock(profile: BusinessProfile): IBusinessProfileLock {
  return {
    id: profile.id,
    userId: profile.userId,
    companyName: profile.companyName,
    allowPaymentCredit: profile.allowPaymentCredit,
    commissionRate: profile.commissionRate,
    isPartnerPlatform: profile.isPartnerPlatform,
    accountBalance: profile.accountBalance,
  };
}

function applyBusinessLock(profile: BusinessProfile, lock: IBusinessProfileLock): void {
  profile.accountBalance = lock.accountBalance;
}

function asUnitOfWork(tx: ProfilesTx): IUnitOfWork {
  return tx as IUnitOfWork;
}

@Injectable()
export class SharedDbProfilesAdapter implements IProfilesReader, IProfilesLedger {
  constructor(
    private readonly businessProfiles: BusinessProfileRepository,
    private readonly consultantProfiles: ConsultantProfileRepository,
    private readonly consultantSkills: ConsultantSkillRepository,
  ) {}

  public async findBusinessByUserAndId(
    userId: string,
    businessId: string,
  ): Promise<IBusinessProfileSnapshot | null> {
    const profile = await this.businessProfiles.findOneByUserAndId(userId, businessId);
    return profile ? toBusinessSnapshot(profile) : null;
  }

  public async findConsultantByUserId(userId: string): Promise<IConsultantProfileSnapshot | null> {
    const profile = await this.consultantProfiles.findByUserId(userId);
    return profile ? toConsultantSnapshot(profile) : null;
  }

  public async findBusinessById(id: string): Promise<IBusinessProfileSnapshot | null> {
    const profile = await this.businessProfiles.findOne({ where: { id } });
    return profile ? toBusinessSnapshot(profile) : null;
  }

  public async findConsultantById(id: string): Promise<IConsultantProfileSnapshot | null> {
    const profile = await this.consultantProfiles.findOne({ where: { id } });
    return profile ? toConsultantSnapshot(profile) : null;
  }

  public async findConsultantSkills(consultantId: string): Promise<IConsultantSkillSnapshot[]> {
    const rows = await this.consultantSkills.findByConsultantId(consultantId);
    return rows.map((row) => ({
      consultantId,
      skillId: row.skillId,
      skillName: row.skill?.name ?? '',
      proficiencyLevel: row.proficiencyLevel,
      rating: row.rating,
    }));
  }

  public async findConsultantSkillsByIds(
    consultantIds: string[],
  ): Promise<IConsultantSkillSnapshot[]> {
    const rows = await this.consultantSkills.findByConsultantIds(consultantIds);
    return rows.map((row) => ({
      consultantId: row.consultant_id,
      skillId: row.skill_id,
      skillName: row.skill_name,
      proficiencyLevel: row.proficiency_level,
      rating: row.rating,
    }));
  }

  public async countSkillMatchForProject(consultantId: string, projectId: string): Promise<number> {
    const row = await this.consultantSkills
      .createQueryBuilder('cs')
      .select('COUNT(*)::int', 'count')
      .where('cs.consultant_id = :consultantId', { consultantId })
      .andWhere(
        'cs.skill_id IN (SELECT prs.skill_id FROM project_required_skills prs WHERE prs.project_id = :projectId)',
        { projectId },
      )
      .getRawOne<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  public async lockBusinessProfile(
    id: string,
    tx: ProfilesTx,
  ): Promise<IBusinessProfileLock | null> {
    const profile = await asUnitOfWork(tx).businessProfiles.findByIdForUpdate(id);
    return profile ? toBusinessLock(profile) : null;
  }

  public async saveBusinessProfile(profile: IBusinessProfileLock, tx: ProfilesTx): Promise<void> {
    const entity = await asUnitOfWork(tx).businessProfiles.findByIdForUpdate(profile.id);
    if (!entity) {
      return;
    }
    applyBusinessLock(entity, profile);
    await asUnitOfWork(tx).businessProfiles.save(entity);
  }

  public async creditConsultant(
    consultantId: string,
    amount: string,
    tx: ProfilesTx,
  ): Promise<void> {
    await asUnitOfWork(tx).consultantProfiles.incrementAccountBalance(consultantId, amount);
  }

  public async findBusinessInTransaction(
    id: string,
    tx: ProfilesTx,
  ): Promise<IBusinessProfileSnapshot | null> {
    const profile = await asUnitOfWork(tx).businessProfiles.findOne({ where: { id } });
    return profile ? toBusinessSnapshot(profile) : null;
  }

  public async findConsultantInTransaction(
    id: string,
    tx: ProfilesTx,
  ): Promise<IConsultantProfileSnapshot | null> {
    const profile = await asUnitOfWork(tx).consultantProfiles.findOne({ where: { id } });
    return profile ? toConsultantSnapshot(profile) : null;
  }
}
