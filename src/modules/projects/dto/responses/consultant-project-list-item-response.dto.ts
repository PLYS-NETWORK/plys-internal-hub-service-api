import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

import { CompanyAddressResponseDto } from './consultant-project-response.dto';
import { IConsultantProjectListItemResponse } from './interfaces/consultant-project-list-item.response.interface';
import { ProjectSkillResponseDto } from './project-skill-response.dto';

@Exclude()
export class ConsultantProjectListItemResponseDto implements IConsultantProjectListItemResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

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
  @ApiProperty({ name: 'required_consultants', example: 2 })
  public readonly required_consultants!: number;

  @Expose()
  @ApiProperty({ name: 'published_at', nullable: true })
  public readonly published_at!: Date | null;

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
  @ApiProperty({
    name: 'need_interview',
    example: true,
    description: 'True when the project has at least one interview question to answer.',
  })
  public readonly need_interview!: boolean;
}
