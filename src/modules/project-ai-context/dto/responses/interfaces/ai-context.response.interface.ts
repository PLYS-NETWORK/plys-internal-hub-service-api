// Full project_ai_context shape used by the debug `GET /ai-context` admin
// endpoint. Bootstrap returns a stripped subset (no audit columns) — see
// IBootstrapAiContext in the ai-bootstrap module.
export interface IAiContextResponse {
  project_id: string;
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
  task_count_at_index: number;
  needs_reindex: boolean;
  created_at: Date;
  updated_at: Date;
}
