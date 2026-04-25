import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { FileContentValidator } from '@common/modules/file-storage';
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

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
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: { type: 'string', maxLength: 64 },
      },
      required: ['file'],
    },
  })
  public async upload(@Req() req: FastifyRequest): Promise<ITranslatedPayload<FileResponseDto>> {
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

    const purposeField = part.fields['purpose'];
    const purpose =
      purposeField && !Array.isArray(purposeField) && purposeField.type === 'field'
        ? String(purposeField.value ?? '').trim() || undefined
        : undefined;

    const data = await this.filesService.upload(input, { purpose });
    return { messageKey: 'success.created', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a file by id' })
  public async getById(@Param('id') id: string): Promise<ITranslatedPayload<FileResponseDto>> {
    const data = await this.filesService.getById(id);
    return { messageKey: 'success.ok', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file (soft delete)' })
  public async remove(@Param('id') id: string): Promise<void> {
    await this.filesService.remove(id);
  }
}
