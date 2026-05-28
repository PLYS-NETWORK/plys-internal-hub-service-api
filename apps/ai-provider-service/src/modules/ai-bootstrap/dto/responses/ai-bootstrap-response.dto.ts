import { ChatSessionListItemResponseDto } from '@modules/project-chat-session/dto/responses';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus, TaskCreationMode, TaskKanbanStatus } from '@plys/libraries/database/enums';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  IAiBootstrapResponse,
  IBootstrapAiContext,
  IBootstrapLiveSetting,
  IBootstrapLiveTask,
  IBootstrapProject,
  IBootstrapSkill,
} from './interfaces/ai-bootstrap.response.interface';

@Exclude()
export class BootstrapProjectDto implements IBootstrapProject {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ example: 'WEB' }) public readonly code!: string;
  @Expose() @ApiProperty() public readonly title!: string;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Tiptap doc, opaque to the BE.',
    type: 'object',
    additionalProperties: true,
  })
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ enum: ProjectStatus })
  public readonly status!: ProjectStatus;
}

@Exclude()
export class BootstrapAiContextDto implements IBootstrapAiContext {
  @Expose() @ApiProperty({ nullable: true }) public readonly domain!: string | null;

  @Expose()
  @ApiProperty({ name: 'primary_stack', type: [String], nullable: true })
  public readonly primary_stack!: string[] | null;

  @Expose() @ApiProperty({ nullable: true }) public readonly conventions!: string | null;

  @Expose()
  @ApiProperty({
    name: 'task_index',
    description: 'Compact task projection maintained by the BE; FE patches `summary`.',
  })
  public readonly task_index!: Record<string, unknown>[];

  @Expose()
  @ApiProperty({
    name: 'skill_clusters',
    description: 'Skill usage clusters keyed by skill UUID. FE-managed.',
  })
  public readonly skill_clusters!: Record<string, unknown>;

  @Expose()
  @ApiProperty({ name: 'planning_summary', nullable: true })
  public readonly planning_summary!: string | null;

  @Expose()
  @ApiProperty({ name: 'refine_summary', nullable: true })
  public readonly refine_summary!: string | null;

  @Expose()
  @ApiProperty({ name: 'extend_summary', nullable: true })
  public readonly extend_summary!: string | null;

  @Expose() @ApiProperty() public readonly decisions!: Record<string, unknown>[];

  @Expose() @ApiProperty({ name: 'last_indexed_at' }) public readonly last_indexed_at!: Date;

  @Expose() @ApiProperty({ name: 'needs_reindex' }) public readonly needs_reindex!: boolean;
}

@Exclude()
export class BootstrapLiveTaskDto implements IBootstrapLiveTask {
  @Expose() @ApiProperty() public readonly id!: string;
  @Expose() @ApiProperty({ example: 'WEB-1' }) public readonly code!: string;
  @Expose() @ApiProperty() public readonly title!: string;

  @Expose()
  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  public readonly description!: Record<string, unknown> | null;

  @Expose() @ApiProperty({ example: '500.00' }) public readonly price!: string;

  @Expose()
  @ApiProperty({ name: 'creation_mode', enum: TaskCreationMode })
  public readonly creation_mode!: TaskCreationMode;

  @Expose()
  @ApiProperty({ name: 'kanban_status', enum: TaskKanbanStatus })
  public readonly kanban_status!: TaskKanbanStatus;

  @Expose() @ApiProperty({ name: 'display_order' }) public readonly display_order!: number;
}

@Exclude()
export class BootstrapSkillDto implements IBootstrapSkill {
  @Expose() @ApiProperty() public readonly id!: string;

  @Expose()
  @ApiProperty({ description: 'Translated label for the request locale.' })
  public readonly name!: string;
}

@Exclude()
export class BootstrapLiveSettingDto implements IBootstrapLiveSetting {
  @Expose()
  @ApiProperty({
    name: 'max_consultants',
    description:
      'Mirror of `projects.required_consultants` — exposed under the `max_consultants` ' +
      'name the FE settings UI uses.',
  })
  public readonly max_consultants!: number;
}

@Exclude()
export class AiBootstrapResponseDto implements IAiBootstrapResponse {
  @Expose()
  @Type(() => BootstrapProjectDto)
  @ApiProperty({ type: () => BootstrapProjectDto })
  public readonly project!: BootstrapProjectDto;

  @Expose()
  @Type(() => BootstrapAiContextDto)
  @ApiProperty({
    type: () => BootstrapAiContextDto,
    nullable: true,
    description: 'Null when no context row has been created for this project yet.',
  })
  public readonly context!: BootstrapAiContextDto | null;

  @Expose()
  @Type(() => ChatSessionListItemResponseDto)
  @ApiProperty({ type: () => [ChatSessionListItemResponseDto] })
  public readonly sessions!: ChatSessionListItemResponseDto[];

  @Expose()
  @Type(() => BootstrapLiveSettingDto)
  @ApiProperty({ name: 'live_setting', type: () => BootstrapLiveSettingDto })
  public readonly live_setting!: BootstrapLiveSettingDto;

  @Expose()
  @Type(() => BootstrapLiveTaskDto)
  @ApiProperty({ name: 'live_tasks', type: () => [BootstrapLiveTaskDto] })
  public readonly live_tasks!: BootstrapLiveTaskDto[];

  @Expose()
  @Type(() => BootstrapSkillDto)
  @ApiProperty({ name: 'live_skills', type: () => [BootstrapSkillDto] })
  public readonly live_skills!: BootstrapSkillDto[];

  @Expose()
  @Type(() => BootstrapSkillDto)
  @ApiProperty({ name: 'available_skills', type: () => [BootstrapSkillDto] })
  public readonly available_skills!: BootstrapSkillDto[];
}
