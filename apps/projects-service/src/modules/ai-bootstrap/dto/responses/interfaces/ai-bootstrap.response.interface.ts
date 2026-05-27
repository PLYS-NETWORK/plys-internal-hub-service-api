import { IChatSessionListItemResponse } from '@modules/project-chat-session/dto/responses/interfaces/chat-session.response.interface';
import { ProjectStatus, TaskCreationMode, TaskKanbanStatus } from '@plys/libraries/database/enums';

export interface IBootstrapProject {
  id: string;
  code: string;
  title: string;
  introduction: Record<string, unknown> | null;
  status: ProjectStatus;
}

// Snapshot of `project_ai_context` as the FE sees it. All fields are nullable
// when no row exists yet (the BE returns the embedded `context: null` in that
// case) — see C-4 for the lazy-create + light-update path.
export interface IBootstrapAiContext {
  domain: string | null;
  primary_stack: string[] | null;
  conventions: string | null;
  task_index: Record<string, unknown>[];
  skill_clusters: Record<string, unknown>;
  planning_summary: string | null;
  refine_summary: string | null;
  extend_summary: string | null;
  decisions: Record<string, unknown>[];
  last_indexed_at: Date;
  needs_reindex: boolean;
}

export interface IBootstrapLiveTask {
  id: string;
  code: string;
  title: string;
  description: Record<string, unknown> | null;
  price: string;
  creation_mode: TaskCreationMode;
  kanban_status: TaskKanbanStatus;
  display_order: number;
}

export interface IBootstrapSkill {
  id: string;
  name: string;
}

export interface IBootstrapLiveSetting {
  max_consultants: number;
}

// Aggregate read for the chat surface. A single round trip yields enough to
// hydrate the chat panel (sessions, project state, tools-side context) so the
// FE doesn't fan out to 5+ endpoints on every chat open.
export interface IAiBootstrapResponse {
  project: IBootstrapProject;
  context: IBootstrapAiContext | null;
  sessions: IChatSessionListItemResponse[];
  live_setting: IBootstrapLiveSetting;
  live_tasks: IBootstrapLiveTask[];
  live_skills: IBootstrapSkill[];
  available_skills: IBootstrapSkill[];
}
