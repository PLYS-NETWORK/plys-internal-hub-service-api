/** @typedef {'dev' | 'prod'} DeployEnv */

const RUNTIME_SERVICES = [
  'api-gateway',
  'identity-service',
  'profiles-service',
  'projects-service',
  'finance-service',
  'platform-service',
];

const BASE_COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.apps.yml'];

/**
 * @param {object} options
 * @param {DeployEnv} options.env
 * @param {string} options.cwd
 * @param {string} options.logDir
 * @param {string} options.deployComposeFile
 */
function buildEcosystem({ env, cwd, logDir, deployComposeFile }) {
  const prefix = `internal-hub-be-${env}`;
  const composeArgs = BASE_COMPOSE_FILES.flatMap((file) => ['-f', file]).concat([
    '-f',
    deployComposeFile,
  ]);

  return {
    apps: RUNTIME_SERVICES.map((service) => ({
      name: `${prefix}-${service}`,
      cwd,
      script: 'docker',
      args: ['compose', ...composeArgs, 'up', '--no-deps', '--remove-orphans', service],
      interpreter: 'none',
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
  buildEcosystem,
};
