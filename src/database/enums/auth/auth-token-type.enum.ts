export enum AuthTokenType {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  MAGIC_LINK = 'magic_link',
}

export const AUTH_TOKEN_TYPES: readonly AuthTokenType[] = [
  AuthTokenType.EMAIL_VERIFICATION,
  AuthTokenType.PASSWORD_RESET,
  AuthTokenType.MAGIC_LINK,
];
