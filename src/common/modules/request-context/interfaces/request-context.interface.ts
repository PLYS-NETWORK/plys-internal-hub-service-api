export interface IRequestContext {
  requestId: string;
  userId: string | null;
  userRole: string | null;
  deviceId: string | null;
  ipAddress: string;
  userAgent: string | null;
  path: string;
  method: string;
}
