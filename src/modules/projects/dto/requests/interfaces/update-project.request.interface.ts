import { IInterviewQuestionItemRequest } from './interview-question-item.request.interface';
import { ITaskItemRequest } from './task-item.request.interface';

export interface IUpdateProjectRequest {
  title?: string;
  introduction?: string;
  required_consultants?: number;
  skills?: string[];
  interviewQuestions?: IInterviewQuestionItemRequest[];
  tasks?: ITaskItemRequest[];
}
