import { ProjectStatus } from '@database/enums';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import {
  ICompanyAddressResponse,
  IConsultantProjectResponse,
} from './interfaces/consultant-project.response.interface';
import { ProjectInterviewQuestionResponseDto } from './project-interview-question-response.dto';
import { ProjectSkillResponseDto } from './project-skill-response.dto';

@Exclude()
export class CompanyAddressResponseDto implements ICompanyAddressResponse {
  @Expose()
  @ApiProperty({ nullable: true, example: '123 Main St' })
  public readonly address_line!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 'Istanbul' })
  public readonly city!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 'Istanbul' })
  public readonly state_province!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: '34000' })
  public readonly postal_code!: string | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 'TR' })
  public readonly country_code!: string | null;
}

@Exclude()
export class ConsultantProjectResponseDto implements IConsultantProjectResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'business_id', example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly business_id!: string;

  @Expose()
  @ApiProperty({ example: 'Build an e-commerce platform' })
  public readonly title!: string;

  @Expose()
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'We need a full-stack team...' }],
        },
      ],
    },
  })
  public readonly introduction!: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.PUBLISHED })
  public readonly status!: ProjectStatus;

  @Expose()
  @ApiProperty({ name: 'required_consultants', example: 2 })
  public readonly required_consultants!: number;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true })
  public readonly published_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'started_at', nullable: true })
  public readonly started_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'cancelled_at', nullable: true })
  public readonly cancelled_at!: Date | null;

  @Expose()
  @ApiProperty({ name: 'payment_type', enum: ['per_task', 'monthly'], example: 'per_task' })
  public readonly payment_type!: 'per_task' | 'monthly';

  @Expose()
  @ApiProperty({ name: 'company_name', example: 'Acme Corp' })
  public readonly company_name!: string;

  @Expose()
  @ApiProperty({ name: 'company_address', type: CompanyAddressResponseDto })
  @Type(() => CompanyAddressResponseDto)
  public readonly company_address!: CompanyAddressResponseDto;

  @Expose()
  @ApiProperty({ name: 'is_partner_platform', example: false })
  public readonly is_partner_platform!: boolean;

  @Expose()
  @ApiProperty({ type: [ProjectSkillResponseDto] })
  @Type(() => ProjectSkillResponseDto)
  public readonly skills!: ProjectSkillResponseDto[];

  @Expose()
  @ApiProperty({ name: 'interview_questions', type: [ProjectInterviewQuestionResponseDto] })
  @Type(() => ProjectInterviewQuestionResponseDto)
  public readonly interview_questions!: ProjectInterviewQuestionResponseDto[];
}
