import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

import { IRemoveSkillsRequest } from './remove-skills.request.interface';

export class RemoveSkillsDto implements IRemoveSkillsRequest {
  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'List of skill UUIDs to remove',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  public readonly ids!: string[];
}
