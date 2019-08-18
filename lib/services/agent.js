const SocketIo = require('socket.io-client');
const config = require('./config');
const eventBus = require('./event-bus');

class Agent {
  init() {
    this.client = SocketIo(`${config.config.endpoint}/agent`);
    this.client.on('connect', () => {
      eventBus.publish('log/debug', `url=${config.config.endpoint} | socketio opened`);
      this.client.emit('getPoolAddress', this.onNewPoolAddress.bind(this));
      this.client.on('newPoolAddress', this.onNewPoolAddress.bind(this));
    });
    this.client.on('disconnect', () => {
      eventBus.publish('log/debug', `url=${config.config.endpoint} | socketio closed`);
    });
  }

  onNewPoolAddress(poolAddress) {
    if (this.poolAddress && this.poolAddress === poolAddress) {
      return;
    }
    this.poolAddress = poolAddress;
    eventBus.publish('log/info', `Best pool address: ${this.poolAddress}`);
    eventBus.publish('ensure-pool-address', this.poolAddress);
  }
}

module.exports = new Agent();
