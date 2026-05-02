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
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Stores an uploaded file with `purpose = NULL`. The owning surface ' +
      '(task comment / evidence) sets the purpose later when the file is ' +
      'attached. Free uploads that are never attached are reclaimed by the ' +
      'weekly orphan-cleanup cron after the configured grace window.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
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
    const data = await this.filesService.upload(input);
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
