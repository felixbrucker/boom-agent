const logger = require('./lib/services/logger');
const config = require('./lib/services/config');
const agent = require('./lib/services/agent');
const wallet = require('./lib/services/wallet');

(async () => {
  await config.init();
  await wallet.init();
  agent.init();
})();