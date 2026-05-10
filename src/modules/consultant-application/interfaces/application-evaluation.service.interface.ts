export interface ICopyleaksEvaluationService {
  /**
   * Runs Copyleaks AI-content check on all 30 answers for the given application.
   * Saves per-answer `copyleaksAiScore`, computes aggregate, and transitions
   * status to either PENDING_AI_EVALUATION (pass) or COPYLEAKS_FAILED (fail).
   *
   * @param applicationId UUID of the consultant application.
   */
  runCopyleaksEvaluation(applicationId: string): Promise<void>;
}

export interface IAiEvaluationService {
  /**
   * Calls the AI provider to score all 30 Q&A pairs for the given application.
   * Saves per-answer `aiEvalScore` + `aiFeedback`, saves `application.aiEvalScore`,
   * and transitions status to PENDING_ADMIN_EVALUATION.
   *
   * @param applicationId UUID of the consultant application.
   */
  runAiEvaluation(applicationId: string): Promise<void>;
}
