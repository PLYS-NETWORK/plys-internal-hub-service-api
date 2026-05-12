import { Public } from '@common/decorators/public.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ContactService } from './contact.service';
import { ContactInquirySubmittedResponseDto, SubmitContactInquiryDto } from './dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  // 5 submissions per hour per IP — same shape as /auth/forgot-password.
  // Enforced by the globally-registered AuthThrottlerGuard.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a contact inquiry (public marketing form)',
    description:
      'Validates input, persists the inquiry, and fires off internal-notification + acknowledgement emails (fire-and-forget). 422 on validation failures including honeypot, 429 on rate limit.',
  })
  public async submit(
    @Body() dto: SubmitContactInquiryDto,
  ): Promise<ITranslatedPayload<ContactInquirySubmittedResponseDto>> {
    const data = await this.contactService.submit({
      name: dto.name,
      email: dto.email,
      company: dto.company,
      topic: dto.topic,
      message: dto.message,
    });
    return { messageKey: 'success.created', data: data as ContactInquirySubmittedResponseDto };
  }
}
