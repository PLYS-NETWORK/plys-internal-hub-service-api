export function sessionQueryParams(
  deviceId?: string,
  fingerprint?: string,
): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  if (deviceId) {
    params.deviceId = deviceId;
  }
  if (fingerprint) {
    params.fingerprint = fingerprint;
  }
  return Object.keys(params).length > 0 ? params : undefined;
}
