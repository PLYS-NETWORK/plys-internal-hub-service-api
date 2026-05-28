import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

const MAX_SKILLS = 20;

// Replace-set semantics: whatever the FE posts becomes the new full skill
// list for the project. Empty array clears all required skills (which is
// allowed; the auto-status recompute will drop the project to `draft`).
export class AiSyncSkillsDto {
  @Expose({ name: 'skill_ids' })
  @ApiProperty({
    name: 'skill_ids',
    type: [String],
    maxItems: MAX_SKILLS,
    description:
      'Full replacement set. Existing required skills not in the array are ' +
      'removed; new ones are inserted. Idempotent — same list = no-op.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SKILLS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  public readonly skillIds!: string[];
}
