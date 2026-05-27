import { IBusinessProfileSnapshot, IConsultantProfileSnapshot } from './profiles-reader.interface';

/** Opaque handle for the active projects-service transaction passed to ledger methods. */
export type ProfilesTx = unknown;

export interface IBusinessProfileLock {
  id: string;
  userId: string;
  companyName: string;
  allowPaymentCredit: boolean;
  commissionRate: string;
  isPartnerPlatform: boolean;
  accountBalance: string;
}

export interface IProfilesLedger {
  lockBusinessProfile(id: string, tx: ProfilesTx): Promise<IBusinessProfileLock | null>;
  saveBusinessProfile(profile: IBusinessProfileLock, tx: ProfilesTx): Promise<void>;
  creditConsultant(consultantId: string, amount: string, tx: ProfilesTx): Promise<void>;
  findBusinessInTransaction(id: string, tx: ProfilesTx): Promise<IBusinessProfileSnapshot | null>;
  findConsultantInTransaction(
    id: string,
    tx: ProfilesTx,
  ): Promise<IConsultantProfileSnapshot | null>;
}
