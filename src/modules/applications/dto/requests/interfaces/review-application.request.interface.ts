export interface IReviewApplicationRequest {
  readonly action: 'approve' | 'reject';
  readonly rejectionReason?: string;
}
