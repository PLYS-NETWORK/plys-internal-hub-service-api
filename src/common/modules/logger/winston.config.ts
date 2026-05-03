import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

// JSON output in every environment so log shape is identical between local
// dev and Loki / Promtail. For colorised local viewing pipe through `jq -C`.
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json(),
);

// nest-winston's forRoot ignores the `instance` option and always passes the
// raw options to `winston.createLogger`. We therefore export the level +
// transports directly and build two winston instances from the same config —
// both write to the same stdout with the same format, so behaviour is identical.
const buildTransports = (): winston.transport[] => [
  new winston.transports.Console({ format: jsonFormat }),
];

export const appWinstonLogger: winston.Logger = winston.createLogger({
  level: 'info',
  transports: buildTransports(),
});

export const appWinstonOptions: WinstonModuleOptions = {
  level: 'info',
  transports: buildTransports(),
};
