import { ApiProperty } from '@nestjs/swagger';

export class StandardizedResponse<T> {
  @ApiProperty({ example: 200 })
  public readonly statusCode: number;

  @ApiProperty({ example: 'OK' })
  public readonly message: string;

  @ApiProperty()
  public readonly data: T | null;

  @ApiProperty({ example: '2026-04-18T00:00:00.000Z' })
  public readonly timestamp: string;

  @ApiProperty({ example: '/api/v1/products' })
  public readonly path: string;

  constructor(statusCode: number, message: string, data: T | null, path: string) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
    this.path = path;
  }
}
