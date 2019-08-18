const fs = require('fs');
const YAML = require('js-yaml');
const eventBus = require('./event-bus');

class Config {
  static get defaultConfig() {
    return {
      endpoint: 'https://boom-gateway.foxypool.cf',
      accountIdToPassPhrase: {
        '1234567890': 'my secret passphrase here',
      },
      rePledgeThreshold: 5,
      walletUrl: 'http://127.0.0.1:9925',
    };
  }

  static logErrorAndExit(error) {
    eventBus.publish('log/error', `There is an error with your config file: ${error}`);
    process.exit(1);
  }

  async init() {
    this.filePath = 'boom-agent.yaml';
    await this.loadFromFile();
  }

  async loadFromFile() {
    let file;
    try {
      file = fs.readFileSync(this.filePath);
    } catch (err) {
      eventBus.publish('log/info', `First start detected, creating the config file (${this.filePath}), please adjust it to your preferences.`);
      this.initFromObject();
      this.saveToFile();
      process.exit(0);
    }
    let configObject = null;
    try {
      configObject = YAML.safeLoad(file);
    } catch (err) {
      Config.logErrorAndExit(err);
    }
    this.initFromObject(configObject);
  }

  saveToFile() {
    const yaml = YAML.safeDump(this.config, {
      lineWidth: 140,
    });
    fs.writeFileSync(this.filePath, yaml, 'utf8');
  }

  initFromObject(configObject = null) {
    this._config = configObject || Config.defaultConfig;
  }

  get config() {
    return this._config;
  }

  get rePledgeThreshold() {
    return this.config.rePledgeThreshold || 5;
  }
}

module.exports = new Config();
