/** @typedef {'dev' | 'prod'} DeployEnv */

const RUNTIME_SERVICES = [
  'api-gateway',
  'identity-service',
  'profiles-service',
  'projects-service',
  'finance-service',
  'platform-service',
];

const BACKEND_SERVICES = RUNTIME_SERVICES.filter((service) => service !== 'api-gateway');

/** PM2 starts backends before api-gateway so gRPC ports are up before the gateway bootstraps. */
const PM2_START_ORDER = [...BACKEND_SERVICES, 'api-gateway'];

/**
 * @param {object} options
 * @param {DeployEnv} options.env
 * @param {string} options.cwd
 * @param {string} options.logDir
 * @param {string} options.deployComposeFile
 */
function buildEcosystem({ env, cwd, logDir, deployComposeFile }) {
  const prefix = `internal-hub-be-${env}`;

  return {
    apps: PM2_START_ORDER.map((service) => ({
      name: `${prefix}-${service}`,
      cwd,
      script: 'scripts/start-compose-service.sh',
      args: [service, env],
      interpreter: 'bash',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 10000,
      max_memory_restart: '300M',
      merge_logs: false,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: `${logDir}/${service}-error.log`,
      out_file: `${logDir}/${service}-out.log`,
    })),
  };
}

module.exports = {
  RUNTIME_SERVICES,
  BACKEND_SERVICES,
  PM2_START_ORDER,
  buildEcosystem,
};
