import { AbstractRepository } from '@common/repositories';
import { ProjectInterviewQuestion } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  IInterviewQuestionWithAnswerCount,
  IProjectInterviewQuestionRepository,
} from './interfaces';

@Injectable()
export class ProjectInterviewQuestionRepository
  extends AbstractRepository<ProjectInterviewQuestion>
  implements IProjectInterviewQuestionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ProjectInterviewQuestion, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ProjectInterviewQuestionRepository(manager) as this;
  }

  /** @inheritdoc */
  public async countDistinctProjectIds(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('q')
      .select('COUNT(DISTINCT q.project_id)', 'count')
      .where('q.project_id IN (:...projectIds)', { projectIds })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async countRequiredByProjectIds(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.createQueryBuilder('q')
      .select('q.project_id', 'project_id')
      .addSelect('COUNT(*)', 'count')
      .where('q.project_id IN (:...projectIds)', { projectIds })
      .andWhere('q.is_required = true')
      .groupBy('q.project_id')
      .getRawMany<{ project_id: string; count: string }>();

    const out = new Map<string, number>();
    for (const r of rows) out.set(r.project_id, Number(r.count));
    return out;
  }

  /** @inheritdoc */
  public async findWithAnswerCountsByProjectId(
    projectId: string,
  ): Promise<IInterviewQuestionWithAnswerCount[]> {
    // Single SQL query: per question, count distinct applicants who answered
    // it. The answer table is tied to applications, so DISTINCT prevents
    // double-counting if a single applicant submits multiple answers per
    // question (shouldn't happen, but the unique index isn't on that pair).
    const rows = await this.createQueryBuilder('q')
      .select('q.id', 'id')
      .addSelect('q.display_order', 'position')
      .addSelect('q.question_text', 'question_text')
      .addSelect(
        `(
          SELECT COUNT(DISTINCT ia.application_id)
          FROM interview_answers ia
          WHERE ia.question_id = q.id
        )`,
        'answer_count',
      )
      .where('q.project_id = :projectId', { projectId })
      .orderBy('q.display_order', 'ASC')
      .addOrderBy('q.id', 'ASC')
      .getRawMany<{
        id: string;
        position: number;
        question_text: string;
        answer_count: string;
      }>();

    return rows.map((r) => ({
      id: r.id,
      position: Number(r.position),
      question_text: r.question_text,
      answer_count: Number(r.answer_count),
    }));
  }
}
