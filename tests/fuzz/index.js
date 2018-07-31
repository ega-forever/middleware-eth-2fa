/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const models = require('../models'),
  _ = require('lodash'),
  Web3 = require('web3'),
  config = require('../config'),
  spawn = require('child_process').spawn,
  Wallet = require('ethereumjs-wallet'),
  WalletProvider = require('../../providers'),
  expect = require('chai').expect,
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

    ctx.service2faPid = spawn('node', ['index.js'], {env: process.env, stdio: 'ignore'});
    await Promise.delay(20000);
  });

  it('validating users balances have enough ethers', async () => {
    ctx.users.owner.balance = await Promise.promisify(ctx.web3.eth.getBalance)(ctx.users.owner.wallet.getAddressString());
    expect(ctx.users.owner.balance.toNumber()).to.be.above(parseInt(ctx.web3.toWei(6, 'ether')));
  });

  it('sending 6 ethers to userFrom from owner', async () => {

    const userFromTransferAmount = ctx.web3.toWei(6, 'ether');

    let userFromTransferTx = await Promise.promisify(ctx.web3.eth.sendTransaction)({
      to: ctx.users.userFrom.wallet.getAddressString(),
      value: userFromTransferAmount,
      from: ctx.users.owner.wallet.getAddressString()
    });

    let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(userFromTransferTx);
    if (tx.blockNumber)
      return;

    await new Promise(res => {
      let intervalId = setInterval(async ()=>{
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
    expect(ctx.users.userFrom.balance.toNumber()).to.be.gte(parseInt(ctx.web3.toWei(6, 'ether')));

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

  it('kill 2fa and create wallet', async () => {

    ctx.service2faPid.kill();

    const web3 = new Web3(new WalletProvider(ctx.users.userFrom.wallet, ctx.web3.currentProvider));

    ctx.contracts.WalletsManager.setProvider(web3.currentProvider);
    const walletsManager = await ctx.contracts.WalletsManager.deployed();
    const walletCreationEstimateGasPrice = await walletsManager.create2FAWallet.estimateGas(0);

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

    const event = {
      name: walletLog.event,
      payload: walletLog.args
    };

    await ctx.amqp.channel.publish('events', `${config.rabbit.serviceName}_chrono_sc.${event.name.toLowerCase()}`, new Buffer(JSON.stringify(event)));
  });


  it('check wallet has been created', async()=>{

    ctx.service2faPid = spawn('node', ['index.js'], {env: process.env, stdio: 'ignore'});
    await Promise.delay(20000);

    let walletExist = await models.userWalletExchangeModel.count({owner: ctx.users.userFrom.wallet.getAddressString()});
    expect(walletExist).to.eq(1);
  });

  after(async () => {
    ctx.service2faPid.kill();
    await Promise.delay(10000);
  });
};
