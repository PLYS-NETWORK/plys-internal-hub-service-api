import { TrendPeriod } from '../../requests/projects-trend.dto';
import { IProjectTrendPointResponse } from './project-trend-point.response.interface';

export interface IProjectTrendResponse {
  /** Grouping that produced the series. */
  period: TrendPeriod;
  /** Time-series points sorted ascending. */
  data: IProjectTrendPointResponse[];
}
