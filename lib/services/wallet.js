const superagent = require('superagent');
const JSONbig = require('json-bigint');
const config = require('./config');
const eventBus = require('./event-bus');

class Wallet {
  async init() {
    this.walletUrl = config.config.walletUrl;
    this.accounts = Object.keys(config.config.accountIdToPassPhrase).map(id => ([id, config.config.accountIdToPassPhrase[id]]));
    this.poolAddress = null;
    this.standardFee = 0.0147;
    await this.updateStandardFee();
    setInterval(this.updateStandardFee.bind(this), 60 * 1000);

    eventBus.subscribe('ensure-pool-address', this.onEnsurePoolAddress.bind(this));
    setInterval(this.checkBalances.bind(this), 10 * 60 * 1000);
  }

  async checkBalances() {
    if (this.movingPledge) {
      return;
    }
    await Promise.all(this.accounts.map(async ([accountId, secretPhrase]) => {
      const balance = await this.getBalance(accountId);
      const pledges = await this.getPledgesFromAccount(accountId);
      if (balance < (config.rePledgeThreshold + (this.standardFee * pledges.length) + (this.standardFee * 2))) {
        return;
      }
      const toPledge = Math.floor(balance - ((this.standardFee * pledges.length) + (this.standardFee * 2)));
      if (toPledge <= 0) {
        return;
      }
      eventBus.publish('log/info', `Creating pledge of ${toPledge} BOOM to ${this.poolAddress} ..`);
      await this.createPledge(this.poolAddress, toPledge, accountId, secretPhrase);
    }));
  }

  async onEnsurePoolAddress(poolAddress) {
    this.poolAddress = poolAddress;
    while(this.movingPledge) {
      await new Promise(resolve => setTimeout(resolve, 30 * 1000));
    }
    this.movingPledge = true;
    await Promise.all(this.accounts.map(async ([accountId, secretPhrase]) => {
      const pledges = await this.getPledgesFromAccount(accountId);
      const outDatedPledges = pledges.filter(pledge => pledge.recipient !== poolAddress);
      if (outDatedPledges.length > 0) {
        const balance = await this.getBalance(accountId);
        if (balance < (outDatedPledges.length * this.standardFee)) {
          eventBus.publish('log/error', `Account ${accountId} doesn't have enough funds to cover the pledge canceling, skipping ..`);
          return;
        }
      }
      for (let pledge of outDatedPledges) {
        eventBus.publish('log/info', `Canceling pledge ${pledge.order} of ${parseInt(pledge.amountNQT, 10) / Math.pow(10, 8)} BOOM to ${pledge.recipient} ..`);
        await this.cancelPledge(pledge.order, secretPhrase);
        const initialHeight = await this.getCurrentHeight();
        let currentHeight = initialHeight;
        while(currentHeight < initialHeight + 1) {
          await new Promise(resolve => setTimeout(resolve, 5 * 1000));
          currentHeight = await this.getCurrentHeight();
        }
      }
      let unconfirmedTransactions = await this.getUnconfirmedTransactions(accountId);
      if (unconfirmedTransactions.length > 0) {
        eventBus.publish('log/info', `Waiting for all unconfirmed transactions ..`);
      }
      while(unconfirmedTransactions.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 10 * 1000));
        unconfirmedTransactions = await this.getUnconfirmedTransactions(accountId);
      }
      const balance = await this.getBalance(accountId);
      const toPledge = Math.floor(balance - (this.standardFee * 2));
      if (toPledge <= 0) {
        return;
      }
      eventBus.publish('log/info', `Creating pledge of ${toPledge} BOOM to ${poolAddress} ..`);
      await this.createPledge(poolAddress, toPledge, accountId, secretPhrase);
    }));
    this.movingPledge = false;
  }

  async updateStandardFee() {
    const fees = await this.doApiCall('suggestFee');
    this.standardFee = parseInt(fees.standard, 10) / Math.pow(10, 8);
  }

  async getPledgesFromAccount(account) {
    return this.doApiCall('getPledgesByAccount', {
      account,
    });
  }

  async createPledge(recipient, amount, account, secretPhrase) {
    return this.doApiCall('createPledge', {
      recipient,
      amountNQT: Math.round(amount * Math.pow(10, 8)),
      secretPhrase,
      feeNQT: Math.round(this.standardFee * Math.pow(10, 8)),
      deadline: 150,
    }, 'post');
  }

  async cancelPledge(txId, secretPhrase) {
    let res = await this.doApiCall('cancelPledge', {
      order: txId,
      secretPhrase,
      feeNQT: Math.round(this.standardFee * Math.pow(10, 8)),
      deadline: 150,
    }, 'post');

    while(res.error) {
      await new Promise(resolve => setTimeout(resolve, 10 * 1000));

      res = await this.doApiCall('cancelPledge', {
        order: txId,
        secretPhrase,
        feeNQT: Math.round(this.standardFee * Math.pow(10, 8)),
        deadline: 150,
      }, 'post');
    }

    return res;
  }

  async getBalance(account) {
    const balanceData = await this.doApiCall('getBalance', {
      account,
    });

    return parseInt(balanceData.balanceNQT, 10) / Math.pow(10, 8);
  }

  async getUnconfirmedTransactions(account) {
    const res = await this.doApiCall('getUnconfirmedTransactions', {
      account,
    });

    return res.unconfirmedTransactions;
  }

  async getCurrentHeight() {
    const miningInfo = this.doApiCall('getMiningInfo');

    return parseInt(miningInfo.height, 10);
  }

  async doApiCall(requestType, params = {}, method = 'get') {
    const queryParams = Object.assign(params, {requestType});
    const res = await superagent[method](`${this.walletUrl}/boom`).query(queryParams);

    return JSONbig.parse(res.text);
  }
}

module.exports = new Wallet();
