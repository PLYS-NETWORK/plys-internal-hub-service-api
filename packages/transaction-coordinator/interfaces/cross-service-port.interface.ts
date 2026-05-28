import { EntityManager } from 'typeorm';

/** Shared DB transaction handle passed across service ports during composite flows. */
export type SharedDbTransaction = EntityManager;

export interface ICrossServicePort {
  /** Participates in an existing shared-db transaction (same EntityManager). */
  withManager(manager: SharedDbTransaction): this;
}
