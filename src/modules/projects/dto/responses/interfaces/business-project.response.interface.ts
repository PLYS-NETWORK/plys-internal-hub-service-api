import { ProjectStatus } from '@database/enums/project-status.enum';

import { IProjectInterviewQuestionResponse } from './project-interview-question.response.interface';
import { IProjectSkillResponse } from './project-skill.response.interface';
import { IProjectTaskResponse } from './project-task.response.interface';

export interface IBusinessProjectResponse {
  id: string;
  business_id: string;
  title: string;
  introduction: string | null;
  status: ProjectStatus;
  required_consultants: number;
  published_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  skills: IProjectSkillResponse[];
  interview_questions: IProjectInterviewQuestionResponse[];
  tasks: IProjectTaskResponse[];
}
