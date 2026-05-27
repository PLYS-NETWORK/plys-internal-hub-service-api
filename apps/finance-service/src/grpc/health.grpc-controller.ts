import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

interface IHealthCheckRequest {
  service?: string;
}

interface IHealthCheckResponse {
  status: number;
}

@Controller()
export class HealthGrpcController {
  @GrpcMethod('Health', 'Check')
  public check(_request: IHealthCheckRequest): IHealthCheckResponse {
    return { status: 1 };
  }
}
