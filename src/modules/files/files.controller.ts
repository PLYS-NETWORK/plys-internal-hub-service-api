import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { FileContentValidator } from '@common/modules/file-storage';
import { FilePurpose } from '@database/enums';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';

import { FileResponseDto } from './dto/responses';
import { FilesService } from './files.service';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly validator: FileContentValidator,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Stores an uploaded file. By default `purpose = NULL` and the surface that ' +
      'later references it sets the purpose via markAsAttached. The optional ' +
      '`?purpose=consultant_cv` or `?purpose=avatar` query params are the only ' +
      'purposes accepted at upload time; passing them stores the file at ' +
      '`consultant-CVs/<env>/...` or `avatars/<env>/...` respectively and stamps ' +
      'the row with the matching purpose. Other purpose values are ignored ' +
      '(server treats the upload as purpose-less). Free uploads that are never ' +
      'attached are reclaimed by the weekly orphan-cleanup cron after the ' +
      'configured grace window.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'purpose',
    required: false,
    enum: FilePurpose,
    description:
      'Optional upload-time purpose marker. Only `consultant_cv` and `avatar` are honoured.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  public async upload(
    @Req() req: FastifyRequest,
    @Query('purpose') purpose?: string,
  ): Promise<ITranslatedPayload<FileResponseDto>> {
    const part = await req.file();
    if (!part) {
      throw new TranslatableException({
        messageKey: 'error.file.upload_failed',
        errorCode: ERROR_CODES.FILE_UPLOAD_FAILED,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    let buffer: Buffer;
    try {
      buffer = await part.toBuffer();
    } catch (err: unknown) {
      // @fastify/multipart throws RequestFileTooLargeError when limits.fileSize
      // is exceeded mid-stream — translate to our typed error.
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new TranslatableException({
          messageKey: 'error.file.size_exceeded',
          errorCode: ERROR_CODES.FILE_SIZE_EXCEEDED,
          status: HttpStatus.PAYLOAD_TOO_LARGE,
        });
      }
      throw err;
    }

    const input = await this.validator.validate(buffer, part.filename);
    // Only CONSULTANT_CV and AVATAR are honoured at upload time — every other
    // value is silently dropped so existing callers that already send unrelated
    // `purpose` strings keep working.
    const acceptedPurpose =
      purpose === FilePurpose.CONSULTANT_CV
        ? FilePurpose.CONSULTANT_CV
        : purpose === FilePurpose.AVATAR
          ? FilePurpose.AVATAR
          : undefined;
    const data = await this.filesService.upload(input, acceptedPurpose);
    return { messageKey: 'success.created', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a file by id' })
  public async getById(@Param('id') id: string): Promise<ITranslatedPayload<FileResponseDto>> {
    const data = await this.filesService.getById(id);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download a file by id (ownership enforced)',
    description:
      'Streams the bytes for the LOCAL provider and 302-redirects to a ' +
      'short-lived presigned URL for cloud providers. Bypasses the ' +
      'standardized response envelope — the response body is the file ' +
      'bytes (or empty on the 302). Non-owners and admins-only-for-other ' +
      'rows receive 404 to avoid leaking existence.',
  })
  public async download(@Param('id') id: string, @Res() reply: FastifyReply): Promise<void> {
    const result = await this.filesService.download(id);

    if (result.handle.kind === 'redirect') {
      // 302 — browser follows transparently and the presigned URL is single-use
      // for practical purposes (60s TTL on the S3 provider).
      await reply.redirect(result.handle.url, HttpStatus.FOUND);
      return;
    }

    // Local stream — write headers, then pipe. RFC 5987 `filename*` carries
    // the UTF-8 original name; the ASCII fallback covers older clients.
    reply
      .header('Content-Type', result.mimeType)
      .header('Content-Length', result.sizeBytes)
      .header('Content-Disposition', this.buildContentDisposition(result.originalName))
      .send(result.handle.stream);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file (soft delete)' })
  public async remove(@Param('id') id: string): Promise<void> {
    await this.filesService.remove(id);
  }

  // RFC 5987 — `filename*` is the source of truth for modern browsers; the
  // ASCII fallback in `filename` keeps legacy clients from rendering garbage
  // when the original name contains non-ASCII bytes.
  private buildContentDisposition(originalName: string): string {
    const ascii = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
    const utf8 = encodeURIComponent(originalName);
    return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
  }
}
