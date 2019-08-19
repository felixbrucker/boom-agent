#!/usr/bin/env node

const logger = require('./lib/services/logger');
const eventBus = require('./lib/services/event-bus');
const config = require('./lib/services/config');
const agent = require('./lib/services/agent');
const wallet = require('./lib/services/wallet');
const version = require('./package').version;

(async () => {
  eventBus.publish('log/info', `BOOM-Agent ${version} starting ..`);
  await config.init();
  await wallet.init();
  await agent.init();
  await wallet.checkBalancesAndRePledge();
})();