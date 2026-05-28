import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { FileResponseDto } from './dto/responses';
import { FilesService } from './files.service';
/** gRPC bridge delegate — HTTP upload/download/remove are handled on api-gateway. */
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a file by id' })
  public async getById(@Param('id') id: string): Promise<ITranslatedPayload<FileResponseDto>> {
    const data = await this.filesService.getById(id);
    return { messageKey: 'success.ok', data };
  }
}
