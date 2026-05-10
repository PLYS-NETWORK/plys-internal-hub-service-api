export interface IAdminDecideRequest {
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly rejectionReason?: string;
}
