import { AbstractRepository } from '@common/repositories';
import { OnboardingQuestion } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IOnboardingQuestionRepository } from './interfaces';

@Injectable()
export class OnboardingQuestionRepository
  extends AbstractRepository<OnboardingQuestion>
  implements IOnboardingQuestionRepository
{
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(OnboardingQuestion, manager);
  }

  public withManager(manager: EntityManager): this {
    return new OnboardingQuestionRepository(manager) as this;
  }

  public async findAllActiveOrdered(): Promise<OnboardingQuestion[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { position: 'ASC' },
    });
  }

  public async findInactivePaginated(params: {
    skip: number;
    take: number;
  }): Promise<{ items: OnboardingQuestion[]; total: number }> {
    const [items, total] = await this.repository.findAndCount({
      where: { isActive: false },
      order: { updatedAt: 'DESC' },
      skip: params.skip,
      take: params.take,
    });
    return { items, total };
  }

  public async findMaxActivePosition(): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('q')
      .select('MAX(q.position)', 'max')
      .where('q.is_active = TRUE')
      .andWhere('q.deleted_at IS NULL')
      .getRawOne<{ max: number | null }>();
    return row?.max ?? 0;
  }

  public async reorderActive(orderedIds: readonly string[]): Promise<void> {
    // Two-phase: temporarily detach every row to NULL position to avoid the
    // partial unique index colliding mid-update, then assign the final positions.
    await this.repository
      .createQueryBuilder()
      .update(OnboardingQuestion)
      .set({ position: null })
      .where('id IN (:...ids)', { ids: [...orderedIds] })
      .execute();

    for (let i = 0; i < orderedIds.length; i += 1) {
      await this.repository
        .createQueryBuilder()
        .update(OnboardingQuestion)
        .set({ position: i + 1 })
        .where('id = :id', { id: orderedIds[i] })
        .execute();
    }
  }

  public async detachAndCompact(id: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(OnboardingQuestion)
      .set({ position: null })
      .where('id = :id', { id })
      .execute();

    // Pull remaining active rows in their current order and renumber 1..N.
    const remaining = await this.repository.find({
      where: { isActive: true },
      order: { position: 'ASC' },
      select: ['id'],
    });
    await this.repository
      .createQueryBuilder()
      .update(OnboardingQuestion)
      .set({ position: null })
      .where('is_active = TRUE')
      .execute();
    for (let i = 0; i < remaining.length; i += 1) {
      await this.repository
        .createQueryBuilder()
        .update(OnboardingQuestion)
        .set({ position: i + 1 })
        .where('id = :id', { id: remaining[i].id })
        .execute();
    }
  }

  public async countActive(): Promise<number> {
    return this.repository.count({ where: { isActive: true } });
  }
}
