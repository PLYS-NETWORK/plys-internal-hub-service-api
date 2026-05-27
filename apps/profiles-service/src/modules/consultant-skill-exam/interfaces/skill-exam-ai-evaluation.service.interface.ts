/**
 * Contract for the AI-scoring stage of the skill-exam pipeline.
 * Runs as the `RUN_SKILL_EXAM_AI_EVAL` Bull job.
 */
export interface ISkillExamAiEvaluationService {
  /**
   * Calls the AI provider with the 20 Q&A pairs, parses per-answer scores +
   * an aggregate, and transitions the exam to PASSED (`>=80`) or FAILED
   * (`<80`). On PASSED also upserts ConsultantSkill (proficiency + rating),
   * inserts a ConsultantSkillScore audit row, recomputes ConsultantProfile.avgRating,
   * and sets `hasNotificationPriority = true` when score >= 90.
   *
   * Emits `CONSULTANT_SKILL_EXAM_PASSED` or `CONSULTANT_SKILL_EXAM_FAILED`
   * (with `metadata.fail_reason = 'LOW_SCORE'`) accordingly.
   *
   * @param examId Skill exam UUID.
   */
  run(examId: string): Promise<void>;

  /**
   * Calls the AI provider to generate 20 questions for the given skill and
   * writes them as `ConsultantSkillExamQuestion` rows. Transitions the exam
   * from `GENERATING_QUESTIONS` → `IN_PROGRESS` and notifies the consultant.
   *
   * @param examId Skill exam UUID.
   */
  generateQuestions(examId: string): Promise<void>;
}
