/**
 * Body shape for the admin flag-toggle PATCH routes
 * (`/admin/business-profiles/:id/partner-platform` and `:id/payment-credit`).
 */
export interface ISetBooleanFlagRequest {
  readonly value: boolean;
}
