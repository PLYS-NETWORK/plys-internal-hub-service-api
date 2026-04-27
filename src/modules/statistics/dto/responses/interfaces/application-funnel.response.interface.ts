export type ApplicationFunnelStage = 'applied' | 'reviewed' | 'approved' | 'active';

export interface IApplicationFunnelStage {
  stage: ApplicationFunnelStage;
  count: number;
  /** Ratio of this stage count to the previous stage. `null` for the first stage. */
  conversion_rate: number | null;
}

export interface IApplicationFunnelResponse {
  stages: IApplicationFunnelStage[];
  /** `active / applied`; `0` when applied = 0. */
  overall_conversion_rate: number;
}
