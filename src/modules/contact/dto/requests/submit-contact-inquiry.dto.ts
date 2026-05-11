import type { ContactTopic } from '@database/entities/contact/contact-inquiry.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEmail, IsEmpty, IsIn, IsOptional, IsString, Length } from 'class-validator';

import { ISubmitContactInquiryRequest } from './interfaces/submit-contact-inquiry.request.interface';

const CONTACT_TOPICS: readonly ContactTopic[] = ['sales', 'partnership', 'press', 'other'];

export class SubmitContactInquiryDto implements ISubmitContactInquiryRequest {
  @Expose()
  @ApiProperty({ name: 'name', example: 'Ada Lovelace' })
  @IsString()
  @Length(1, 120)
  public readonly name!: string;

  @Expose()
  @ApiProperty({ name: 'email', example: 'ada@analytical-engine.co' })
  @IsEmail()
  @Length(1, 254)
  public readonly email!: string;

  @Expose()
  @ApiProperty({ name: 'company', example: 'Analytical Engine Co.' })
  @IsString()
  @Length(1, 200)
  public readonly company!: string;

  @Expose()
  @ApiProperty({ name: 'topic', enum: CONTACT_TOPICS, example: 'sales' })
  @IsIn(CONTACT_TOPICS)
  public readonly topic!: ContactTopic;

  @Expose()
  @ApiProperty({ name: 'message', example: "We'd like enterprise pricing for 12 seats." })
  @IsString()
  @Length(10, 5000)
  public readonly message!: string;

  // Honeypot — must be absent or empty. Bots fill it; humans never see it.
  @Expose()
  @ApiPropertyOptional({ name: 'website', description: 'Honeypot — must be empty.' })
  @IsOptional()
  @IsEmpty()
  public readonly website?: string;
}
