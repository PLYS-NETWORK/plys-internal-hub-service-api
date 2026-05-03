import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

// Production: pure JSON for Loki / Promtail. Dev: colorised printf so
// info/warn/error are visually distinct in the terminal.
const isProduction = process.env.NODE_ENV === 'production';

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ level: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, context, request_id, stack, ...rest } = info as Record<
      string,
      unknown
    >;
    const ctx = context ? ` [${context as string}]` : '';
    const rid = request_id ? ` [${(request_id as string).slice(0, 8)}]` : '';
    const meta = Object.keys(rest).length
      ? ' ' +
        Object.entries(rest)
          .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
          .join(' ')
      : '';
    const stackLine = stack ? `\n${stack as string}` : '';
    const renderedMessage =
      typeof message === 'object' ? JSON.stringify(message) : String(message ?? '');
    return `${timestamp as string} ${level}${ctx}${rid} ${renderedMessage}${meta}${stackLine}`;
  }),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json(),
);

// nest-winston's forRoot ignores the `instance` option and always passes the
// raw options to `winston.createLogger`. We therefore export the level +
// transports directly and build two winston instances from the same config —
// both write to the same stdout with the same format, so behaviour is identical.
const buildTransports = (): winston.transport[] => [
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat,
  }),
];

export const appWinstonLogger: winston.Logger = winston.createLogger({
  level: 'info',
  transports: buildTransports(),
});

export const appWinstonOptions: WinstonModuleOptions = {
  level: 'info',
  transports: buildTransports(),
};
