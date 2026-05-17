import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { IConsultantExploreSkillResponse } from './interfaces/consultant-explore-skill.response.interface';

@Exclude()
export class ConsultantExploreSkillResponseDto implements IConsultantExploreSkillResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ example: 'skill_react', description: 'i18n key stored in DB' })
  public readonly name!: string;

  @Expose()
  @ApiProperty({ example: 'React', description: 'Translated skill label for the request locale' })
  public readonly label!: string;

  @Expose()
  @ApiProperty({
    example: 'category_frontend',
    nullable: true,
    description: 'i18n key stored in DB',
  })
  public readonly category!: string | null;

  @Expose()
  @ApiProperty({
    name: 'category_label',
    example: 'Frontend',
    nullable: true,
    description: 'Translated category label for the request locale',
  })
  public readonly category_label!: string | null;
}
