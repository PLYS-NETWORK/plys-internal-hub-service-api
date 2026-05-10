import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ServerAiService } from '@common/modules/server-ai/server-ai.service';
import { ConsultantApplicationQuestion } from '@database/entities';
import { AiAssistantType, ApplicationStatus, QuestionType } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

import {
  COMMUNICATION_QUESTION_COUNT,
  CONSULTANT_APPLICATION_JOBS,
  CONSULTANT_APPLICATION_QUEUE,
  SKILL_BASED_QUESTION_COUNT,
  SYSTEM_KNOWLEDGE_QUESTION_COUNT,
} from '../consultant-application.constants';
import { AiEvaluationService } from '../services/ai-evaluation.service';
import { CopyleaksEvaluationService } from '../services/copyleaks-evaluation.service';

interface IJobPayload {
  applicationId: string;
}

interface IGeneratedQuestion {
  content: string;
  skill_id: string;
}

@Processor(CONSULTANT_APPLICATION_QUEUE)
export class ConsultantApplicationProcessor {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly serverAiService: ServerAiService,
    private readonly copyleaksEvaluationService: CopyleaksEvaluationService,
    private readonly aiEvaluationService: AiEvaluationService,
    private readonly emailService: EmailService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantApplicationProcessor.name, requestContext);
  }

  @Process(CONSULTANT_APPLICATION_JOBS.GENERATE_SKILL_QUESTIONS)
  public async handleGenerateSkillQuestions(job: Job<IJobPayload>): Promise<void> {
    const { applicationId } = job.data;
    this.logger.log(`handleGenerateSkillQuestions — start | applicationId: ${applicationId}`);

    try {
      await this.generateAndAssignQuestions(applicationId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `handleGenerateSkillQuestions — failed | applicationId: ${applicationId} | error: ${msg}`,
      );

      // Reset status so the consultant can retry profile submission
      const application = await this.uow.consultantApplications.findOne({
        where: { id: applicationId },
      });
      if (application) {
        application.status = ApplicationStatus.PENDING_PROFILE;
        await this.uow.consultantApplications.save(application);
      }

      throw err;
    }
  }

  @Process(CONSULTANT_APPLICATION_JOBS.RUN_COPYLEAKS_EVALUATION)
  public async handleRunCopyleaksEvaluation(job: Job<IJobPayload>): Promise<void> {
    const { applicationId } = job.data;
    this.logger.log(`handleRunCopyleaksEvaluation — start | applicationId: ${applicationId}`);

    try {
      await this.copyleaksEvaluationService.runCopyleaksEvaluation(applicationId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `handleRunCopyleaksEvaluation — failed | applicationId: ${applicationId} | error: ${msg}`,
      );

      // Allow admin to retry by reverting to INTERVIEW_SUBMITTED
      const application = await this.uow.consultantApplications.findOne({
        where: { id: applicationId },
      });
      if (application && application.status === ApplicationStatus.RUNNING_COPYLEAKS) {
        application.status = ApplicationStatus.INTERVIEW_SUBMITTED;
        await this.uow.consultantApplications.save(application);
      }

      throw err;
    }
  }

  @Process(CONSULTANT_APPLICATION_JOBS.RUN_AI_EVALUATION)
  public async handleRunAiEvaluation(job: Job<IJobPayload>): Promise<void> {
    const { applicationId } = job.data;
    this.logger.log(`handleRunAiEvaluation — start | applicationId: ${applicationId}`);

    try {
      await this.aiEvaluationService.runAiEvaluation(applicationId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `handleRunAiEvaluation — failed | applicationId: ${applicationId} | error: ${msg}`,
      );
      // Retain PENDING_AI_EVALUATION so admin can retry via a separate endpoint
      throw err;
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async generateAndAssignQuestions(applicationId: string): Promise<void> {
    const application = await this.uow.consultantApplications.findOne({
      where: { id: applicationId },
    });
    if (!application) {
      return;
    }

    // Load manual questions
    const communicationQuestions = await this.uow.interviewQuestions.findActiveByType(
      QuestionType.COMMUNICATION,
    );
    const systemKnowledgeQuestions = await this.uow.interviewQuestions.findActiveByType(
      QuestionType.SYSTEM_KNOWLEDGE,
    );

    const selectedComm = communicationQuestions.slice(0, COMMUNICATION_QUESTION_COUNT);
    const selectedSys = systemKnowledgeQuestions.slice(0, SYSTEM_KNOWLEDGE_QUESTION_COUNT);

    // Load consultant skills for AI question generation
    const profile = await this.uow.consultantProfiles.findByUserId(application.userId);
    const skillRows = profile
      ? await this.uow.consultantSkills.find({ where: { consultantId: profile.id } })
      : [];

    const skillList = skillRows.map((s) => ({ id: s.skillId }));
    const aiQuestions = await this.generateSkillQuestions(skillList);

    // Build 30 ordered question assignments
    let order = 1;
    const assignments: Array<{
      applicationId: string;
      questionId: string;
      contentSnapshot: string;
      type: QuestionType;
      skillId: string | null;
      questionOrder: number;
    }> = [];

    // Questions 1–10: COMMUNICATION
    for (const q of selectedComm) {
      assignments.push({
        applicationId,
        questionId: q.id,
        contentSnapshot: q.content,
        type: QuestionType.COMMUNICATION,
        skillId: null,
        questionOrder: order++,
      });
    }

    // Questions 11–25: SKILL_BASED (AI-generated)
    for (const aiQ of aiQuestions.slice(0, SKILL_BASED_QUESTION_COUNT)) {
      assignments.push({
        applicationId,
        questionId: '',
        contentSnapshot: aiQ.content,
        type: QuestionType.SKILL_BASED,
        skillId: aiQ.skill_id,
        questionOrder: order++,
      });
    }

    // Questions 26–30: SYSTEM_KNOWLEDGE
    for (const q of selectedSys) {
      assignments.push({
        applicationId,
        questionId: q.id,
        contentSnapshot: q.content,
        type: QuestionType.SYSTEM_KNOWLEDGE,
        skillId: null,
        questionOrder: order++,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      for (const a of assignments) {
        // For SKILL_BASED, create a transient InterviewQuestion row keyed to skill
        let resolvedQuestionId = a.questionId;
        if (a.type === QuestionType.SKILL_BASED) {
          const iq = tx.interviewQuestions.create({
            type: QuestionType.SKILL_BASED,
            content: a.contentSnapshot,
            skillId: a.skillId,
            isActive: true,
          });
          const savedIq = await tx.interviewQuestions.save(iq);
          resolvedQuestionId = savedIq.id;
        }

        const aq = tx.applicationQuestions.create({
          applicationId: a.applicationId,
          questionId: resolvedQuestionId,
          contentSnapshot: a.contentSnapshot,
          type: a.type,
          skillId: a.skillId,
          questionOrder: a.questionOrder,
        }) as ConsultantApplicationQuestion;

        await tx.applicationQuestions.save(aq);
      }

      const app = await tx.consultantApplications.findOne({ where: { id: applicationId } });
      if (app) {
        app.status = ApplicationStatus.IN_INTERVIEW;
        await tx.consultantApplications.save(app);
      }
    });

    // Notify consultant that questions are ready
    const user = await this.uow.users.findOne({ where: { id: application.userId } });
    const interviewUrl = `${this.envService.lonaUrl}/application/interview`;

    if (user) {
      void this.emailService
        .sendInterviewReadyEmail(user.email, {
          userName: profile?.fullName ?? user.email,
          interviewUrl,
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `generateAndAssignQuestions — interview-ready email failed | applicationId: ${applicationId} | error: ${msg}`,
          );
        });
    }

    this.logger.log(
      `generateAndAssignQuestions — complete | applicationId: ${applicationId}, questions: ${assignments.length}`,
    );
  }

  private async generateSkillQuestions(
    skills: Array<{ id: string }>,
  ): Promise<IGeneratedQuestion[]> {
    if (skills.length === 0) {
      return [];
    }

    const systemPrompt = `You are a senior technical interviewer.
Generate exactly ${SKILL_BASED_QUESTION_COUNT} interview questions for a consultant based on their listed skills.
Distribute questions proportionally across the skills provided.
Return ONLY a JSON array with no extra text:
[
  { "content": "<question text>", "skill_id": "<skill_uuid>" }
]`;

    const userPrompt = `Skill IDs: ${skills.map((s) => s.id).join(', ')}`;

    const raw = await this.serverAiService.complete(
      AiAssistantType.INTERVIEW,
      systemPrompt,
      userPrompt,
    );

    try {
      const parsed = JSON.parse(raw) as IGeneratedQuestion[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      this.logger.error(`generateSkillQuestions — invalid AI response`);
      return [];
    }
  }
}
