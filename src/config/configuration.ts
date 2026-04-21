import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') ?? ['*'],
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    name: process.env.DB_NAME ?? 'marketplace',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    ployosEmail: process.env.RESEND_PLOYOS_EMAIL,
    lonaEmail: process.env.RESEND_LONA_EMAIL,
  },
  payment: {
    // Default to Polar.sh. Set PAYMENT_PROCESSOR=stripe to switch providers.
    processor: process.env.PAYMENT_PROCESSOR ?? 'polar',
    polar: {
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
      topUpProductId: process.env.POLAR_TOP_UP_PRODUCT_ID,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID ?? '',
    },
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/sso/google/callback',
  },
  ployosUrl: process.env.PLOYOS_URL ?? 'http://localhost:3000',
  lonaUrl: process.env.LONA_URL ?? 'http://localhost:3001',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'app:',
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
  },
  copyleaks: {
    apiKey: process.env.COPYLEAKS_API_KEY ?? '',
  },
}));
