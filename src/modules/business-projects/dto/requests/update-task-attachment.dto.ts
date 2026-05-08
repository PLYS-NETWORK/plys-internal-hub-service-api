import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const FILE_NAME_MIN = 1;
const FILE_NAME_MAX = 255;

export class UpdateTaskAttachmentDto {
  @Expose({ name: 'file_name' })
  @ApiProperty({
    name: 'file_name',
    minLength: FILE_NAME_MIN,
    maxLength: FILE_NAME_MAX,
    description: 'Display name; the underlying storage key is never changed.',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(FILE_NAME_MIN)
  @MaxLength(FILE_NAME_MAX)
  public readonly fileName!: string;
}
