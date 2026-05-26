export interface IBusinessSpendTrendPointResponse {
  period_label: string;
  spend: string;
  /** Running cumulative total from the earliest bucket to this bucket inclusive. */
  cumulative: string;
}

export interface IBusinessSpendTrendResponse {
  currency: string;
  granularity: 'month' | 'week';
  points: IBusinessSpendTrendPointResponse[];
}
