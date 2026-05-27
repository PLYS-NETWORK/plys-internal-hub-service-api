const { buildEcosystem } = require('./ecosystem.shared');

module.exports = buildEcosystem({
  env: 'dev',
  cwd: '/apps/internal-hub-be/dev/current',
  logDir: '/apps/internal-hub-be/dev/logs',
  deployComposeFile: 'docker-compose.deploy.dev.yml',
});
