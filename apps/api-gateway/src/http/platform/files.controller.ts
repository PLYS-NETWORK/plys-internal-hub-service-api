import { FileResponseDto } from '@modules/files/dto/responses';
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
import { Throttle } from '@nestjs/throttler';
import {
  THROTTLE_DEFAULT,
  THROTTLE_MODERATE,
  THROTTLE_STRICT,
} from '@plys/libraries/common-nest/constants';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { assertGrpcSuccess, GrpcGatewayHelper } from '@plys/libraries/common-nest/grpc';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { FileContentValidator } from '@plys/libraries/common-nest/modules/file-storage';
import { FilePurpose } from '@plys/libraries/database/enums';
import { FastifyReply, FastifyRequest } from 'fastify';

import { FilesClient } from '@/clients/platform';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
@Throttle(THROTTLE_DEFAULT)
export class PlatformFilesController {
  constructor(
    private readonly filesClient: FilesClient,
    private readonly grpcHelper: GrpcGatewayHelper,
    private readonly validator: FileContentValidator,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(THROTTLE_MODERATE)
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'purpose', required: false, enum: FilePurpose })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
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
    const acceptedPurpose =
      purpose === FilePurpose.CONSULTANT_CV
        ? FilePurpose.CONSULTANT_CV
        : purpose === FilePurpose.AVATAR
          ? FilePurpose.AVATAR
          : undefined;

    return this.grpcHelper.call<FileResponseDto>(this.filesClient, 'files.upload', {
      body: {
        bufferBase64: input.buffer.toString('base64'),
        mimeType: input.mimeType,
        originalName: input.originalName,
        size: input.size,
        extension: input.extension,
        purpose: acceptedPurpose,
      },
      queryParams: purpose ? { purpose } : undefined,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a file by id' })
  public getById(@Param('id') id: string): Promise<ITranslatedPayload<FileResponseDto>> {
    return this.grpcHelper.call(this.filesClient, 'files.getById', { pathParams: { id } });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a file by id (ownership enforced)' })
  public async download(@Param('id') id: string, @Res() reply: FastifyReply): Promise<void> {
    const response = await this.grpcHelper.callRaw(this.filesClient, {
      operation: 'files.download',
      pathParams: { id },
    });

    if (response.statusCode === HttpStatus.FOUND && response.headers?.location) {
      await reply.redirect(response.headers.location, HttpStatus.FOUND);
      return;
    }

    const body = response.body ?? Buffer.alloc(0);
    reply
      .header('Content-Type', response.headers?.['content-type'] ?? 'application/octet-stream')
      .header('Content-Length', response.headers?.['content-length'] ?? String(body.length))
      .send(body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(THROTTLE_STRICT)
  @ApiOperation({ summary: 'Delete a file (soft delete)' })
  public async remove(@Param('id') id: string): Promise<void> {
    const response = await this.grpcHelper.callRaw(this.filesClient, {
      operation: 'files.remove',
      pathParams: { id },
    });
    assertGrpcSuccess(response);
  }
}
