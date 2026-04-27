import { TrendPeriod } from '../projects-trend.dto';
import { IStatsDateRangeRequest } from './stats-date-range.request.interface';

export interface IProjectsTrendRequest extends IStatsDateRangeRequest {
  /** Grouping granularity. */
  period: TrendPeriod;
}
