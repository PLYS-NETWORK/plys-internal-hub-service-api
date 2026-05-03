import { utilities as nestWinstonModuleUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

// Disable ANSI colours in production so log aggregators (Loki, CloudWatch)
// don't ingest escape sequences. Dev keeps them for readability.
const isProduction = process.env.NODE_ENV === 'production';

export const appWinstonOptions: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('Nest', {
          colors: !isProduction,
          prettyPrint: !isProduction,
        }),
      ),
    }),
  ],
};
