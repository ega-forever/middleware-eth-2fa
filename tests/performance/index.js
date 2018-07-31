/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const models = require('../models'),
  _ = require('lodash'),
  speakeasy = require('speakeasy'),
  decryptWithPrivKeyUtil = require('../../utils/crypto/decryptWithPrivKey'),
  exchangeMessageFactory = require('../../factories/messages/exchangeMessageFactory'),
  Web3 = require('web3'),
  config = require('../config'),
  spawn = require('child_process').spawn,
  WalletProvider = require('../../providers'),
  request = require('request-promise'),
  expect = require('chai').expect,
  Wallet = require('ethereumjs-wallet'),
  Promise = require('bluebird');

module.exports = (ctx) => {

  before(async () => {
    await models.userWalletExchangeModel.remove({});

    ctx.users.userFrom = {
      wallet: Wallet.generate(_.random(Math.pow(10, 4), Math.pow(10, 6)))
    };
    ctx.users.userTo = {
      wallet: Wallet.generate(_.random(Math.pow(10, 4), Math.pow(10, 6)))
    };

    const queueId = _.chain(ctx.flows.noderedstorages)
      .map(flow=>flow.body)
      .flattenDeep()
      .find(flow=> flow.ioname === 'events')
      .get('id')
      .thru(id=> `${config.rabbit.serviceName}.${id}`)
      .value();

    await ctx.amqp.channel.deleteQueue(queueId);
    ctx.service2faPid = spawn('node', ['index.js'], {env: process.env, stdio: 'ignore'});
    await Promise.delay(20000);
  });

  it('validating users balances have enough ethers', async () => {
    ctx.users.owner.balance = await Promise.promisify(ctx.web3.eth.getBalance)(ctx.users.owner.wallet.getAddressString());
    expect(ctx.users.owner.balance.toNumber()).to.be.above(parseInt(ctx.web3.toWei(6, 'ether')));
  });

  it('sending 100 ethers to userFrom from owner', async () => {

    const userFromTransferAmount = ctx.web3.toWei(100, 'ether');

    let userFromTransferTx = await Promise.promisify(ctx.web3.eth.sendTransaction)({
      to: ctx.users.userFrom.wallet.getAddressString(),
      value: userFromTransferAmount,
      from: ctx.users.owner.wallet.getAddressString()
    });

    let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(userFromTransferTx);
    if (tx.blockNumber)
      return;

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        if (error)
          return;
        let tx = await Promise.promisify(web3.eth.getTransaction)(userFromTransferTx);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      }, 1000);
    });

  });

  it('validating userFrom balance', async () => {
    ctx.users.userFrom.balance = await Promise.promisify(ctx.web3.eth.getBalance)(ctx.users.userFrom.wallet.getAddressString());
    expect(ctx.users.userFrom.balance.toNumber()).to.be.gte(parseInt(ctx.web3.toWei(100, 'ether')));

  });

  it('set oracle address and price', async () => {

    ctx.contracts.WalletsManager.setProvider(ctx.web3.currentProvider);
    ctx.contracts.Wallet.setProvider(ctx.web3.currentProvider);

    let walletsManager = await ctx.contracts.WalletsManager.deployed();
    const contractOracle = await walletsManager.getOracleAddress();

    if (contractOracle !== ctx.users.middleware.wallet.getAddressString()) {
      const setOracleAddressTxEstimateGas = await walletsManager.setOracleAddress.estimateGas(ctx.users.middleware.wallet.getAddressString());

      const setOracleAddressTx = await walletsManager.setOracleAddress(ctx.users.middleware.wallet.getAddressString(), {
        from: ctx.users.owner.wallet.getAddressString(),
        gas: parseInt(setOracleAddressTxEstimateGas * 1.2)
      });

      expect(setOracleAddressTx.tx).to.be.a('string');

      const latestFilter = ctx.web3.eth.filter('latest');

      await new Promise(res => {
        latestFilter.watch(async function (error) {
          if (error)
            return;
          let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(setOracleAddressTx.tx);
          if (tx.blockNumber) {
            await new Promise(res => latestFilter.stopWatching(res));
            res();
          }
        });
      });
    }

    const estimatePrice = 3000000000 * 300000;
    const price = await walletsManager.getOraclePrice();

    if (parseInt(price.toString()) !== estimatePrice) {
      const setOraclePriceTxEstimateGas = await walletsManager.setOraclePrice.estimateGas(estimatePrice);
      await walletsManager.setOraclePrice(estimatePrice, {
        from: ctx.users.owner.wallet.getAddressString(),
        gas: parseInt(setOraclePriceTxEstimateGas * 1.2)
      });
    }
  });

  it('create 100 wallets and validate them', async () => {

    const web3 = new Web3(new WalletProvider(ctx.users.userFrom.wallet, ctx.web3.currentProvider));

    ctx.contracts.WalletsManager.setProvider(web3.currentProvider);
    const walletsManager = await ctx.contracts.WalletsManager.deployed();
    const walletCreationEstimateGasPrice = await walletsManager.create2FAWallet.estimateGas(0);

    let events = await Promise.mapSeries(new Array(100), async (item, index) => {

      let createWalletTx = await walletsManager.create2FAWallet(0, {
        from: ctx.users.userFrom.wallet.getAddressString(),
        gas: parseInt(walletCreationEstimateGasPrice * 1.5)
      });

      expect(createWalletTx.tx).to.be.a('string');

      await new Promise(res => {
        let intervalId = setInterval(async () => {
          if (!createWalletTx)
            return;
          let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(createWalletTx.tx);
          if (tx.blockNumber) {
            clearInterval(intervalId);
            res();
          }
        }, 1000);
      });


      const walletLog = _.find(createWalletTx.logs, {event: 'WalletCreated'});
      expect(walletLog).to.be.an('object');

      return {
        name: walletLog.event,
        payload: walletLog.args
      };
    });

    for (let event of events)
      await ctx.amqp.channel.publish('events', `${config.rabbit.serviceName}_chrono_sc.${event.name.toLowerCase()}`, new Buffer(JSON.stringify(event)));

    await Promise.delay(10000);
    let wallet = await models.userWalletExchangeModel.findOne({owner: ctx.users.userFrom.wallet.getAddressString()});

    expect(wallet.secret).to.be.a('string');
    expect(wallet.wallets.length).to.eq(100);
    expect(wallet.validated).to.eq(false);

  });

  after(async () => {
    ctx.service2faPid.kill();
    await Promise.delay(10000);
  });
};
