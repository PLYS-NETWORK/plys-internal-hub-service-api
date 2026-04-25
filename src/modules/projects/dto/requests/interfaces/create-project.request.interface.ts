import { IInterviewQuestionItemRequest } from './interview-question-item.request.interface';
import { ITaskItemRequest } from './task-item.request.interface';

export interface ICreateProjectRequest {
  title: string;
  introduction?: Record<string, unknown>;
  required_consultants?: number;
  skills?: string[];
  interviewQuestions?: IInterviewQuestionItemRequest[];
  tasks?: ITaskItemRequest[];
}
