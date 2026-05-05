// Decisions are append-only audit notes the FE writes when a user makes a
// non-trivial choice during planning. The shape matches the JSONB array on
// project_ai_context.decisions.
export type DecisionSource = 'planning' | 'refine' | 'extend';

export interface ILogDecisionRequest {
  decision: string;
  rationale: string;
  source: DecisionSource;
}
