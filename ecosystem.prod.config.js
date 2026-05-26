const { buildEcosystem } = require('./ecosystem.shared');

module.exports = buildEcosystem({
  env: 'prod',
  cwd: '/apps/internal-hub-be/prod/current',
  logDir: '/apps/internal-hub-be/prod/logs',
  deployComposeFile: 'docker-compose.deploy.prod.yml',
});
