import { ProjectInterviewQuestion } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

import { InterviewQuestionItemDto } from '../dto/requests/interview-question-item.dto';

export interface IProjectInterviewQuestionsService {
  findByProjectId(projectId: string, uow?: IUnitOfWork): Promise<ProjectInterviewQuestion[]>;

  createForProject(
    projectId: string,
    items: InterviewQuestionItemDto[],
    uow: IUnitOfWork,
  ): Promise<ProjectInterviewQuestion[]>;

  replaceForProject(
    projectId: string,
    items: InterviewQuestionItemDto[],
    uow: IUnitOfWork,
  ): Promise<ProjectInterviewQuestion[]>;
}
