// Single-row patch sent by the FE after it (re-)derives the AI fields on
// the client side. Every field is optional; whatever the FE sends is merged.
// `taskSummaries` patches matching `task_index` entries by `task_id` so the
// FE doesn't need to rewrite the whole array.
export interface ITaskSummaryPatch {
  taskId: string;
  summary: string;
}

export interface IUpdateDerivedContextRequest {
  domain?: string;
  primaryStack?: string[];
  conventions?: string;
  planningSummary?: string;
  refineSummary?: string;
  extendSummary?: string;
  skillClusters?: Record<string, unknown>;
  taskSummaries?: ITaskSummaryPatch[];
}
