export interface IConsultantInterviewSubmittedEvent {
  readonly application_id: string;
  readonly consultant_user_id: string;
  readonly consultant_name: string;
}

export interface IConsultantApplicationAiRejectedEvent {
  readonly application_id: string;
  readonly consultant_user_id: string;
  readonly consultant_name: string;
}

export interface IConsultantProjectJoinedEvent {
  readonly consultant_user_id: string;
  readonly project_id: string;
  readonly project_code: string;
  readonly project_title: string;
  readonly business_id: string;
}
