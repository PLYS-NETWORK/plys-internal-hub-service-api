import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProjectInterviewQuestion } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, Logger } from '@nestjs/common';

import { InterviewQuestionItemDto } from '../dto/requests/interview-question-item.dto';

@Injectable()
export class ProjectInterviewQuestionsService {
  private readonly logger = new Logger(ProjectInterviewQuestionsService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async findByProjectId(
    projectId: string,
    uow?: IUnitOfWork,
  ): Promise<ProjectInterviewQuestion[]> {
    return (uow ?? this.uow).projectInterviewQuestions.find({
      where: { projectId },
      order: { displayOrder: 'ASC' },
    });
  }

  public async createForProject(
    projectId: string,
    items: InterviewQuestionItemDto[],
    uow: IUnitOfWork,
  ): Promise<ProjectInterviewQuestion[]> {
    if (items.length === 0) return [];

    this.logger.log(
      `[${this.rid}] createForProject — start | projectId: ${projectId}, count: ${items.length}`,
    );

    const entities = items.map((item, index) =>
      uow.projectInterviewQuestions.create({
        projectId,
        questionText: item.questionText,
        displayOrder: index + 1,
        isRequired: item.isRequired ?? true,
      }),
    );
    const saved = await uow.projectInterviewQuestions.save(entities);

    this.logger.log(
      `[${this.rid}] createForProject — complete | projectId: ${projectId}, inserted: ${saved.length}`,
    );
    return saved;
  }

  public async replaceForProject(
    projectId: string,
    items: InterviewQuestionItemDto[],
    uow: IUnitOfWork,
  ): Promise<ProjectInterviewQuestion[]> {
    this.logger.log(
      `[${this.rid}] replaceForProject — start | projectId: ${projectId}, count: ${items.length}`,
    );

    await uow.projectInterviewQuestions.delete({ projectId });
    const result = await this.createForProject(projectId, items, uow);

    this.logger.log(
      `[${this.rid}] replaceForProject — complete | projectId: ${projectId}, inserted: ${result.length}`,
    );
    return result;
  }
}
