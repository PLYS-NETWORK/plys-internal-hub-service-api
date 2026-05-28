import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

import { ISkillResponse } from './skill.response.interface';

@Exclude()
export class SkillResponseDto implements ISkillResponse {
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
    example: 'Frontend',
    nullable: true,
    description: 'Translated category label for the request locale',
  })
  public readonly category_label!: string | null;

  @Expose()
  @ApiProperty({ name: 'created_at' })
  public readonly created_at!: Date;
}
