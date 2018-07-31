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
  Wallet = require('ethereumjs-wallet'),
  spawn = require('child_process').spawn,
  WalletProvider = require('../../providers'),
  request = require('request-promise'),
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

    ctx.users.userFrom2 = {
      wallet: Wallet.generate(_.random(Math.pow(10, 4), Math.pow(10, 6)))
    };
    ctx.users.userTo2 = {
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

  it('create wallet', async () => {

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

  it('transfer', async () => {
    await Promise.delay(10000);

    const web3 = new Web3(new WalletProvider(ctx.users.userFrom.wallet, ctx.web3.currentProvider));

    ctx.contracts.Wallet.setProvider(web3.currentProvider);
    const transferAmount = ctx.web3.toWei(1, 'ether');

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallets/${ctx.users.userFrom.wallet.getAddressString()}`,
      json: true
    });

    let wallet = ctx.contracts.Wallet.at(walletList[0].address);
    let transferToWalletTx = await Promise.promisify(web3.eth.sendTransaction)({
      to: walletList[0].address,
      value: transferAmount,
      gas: 50000,
      from: ctx.users.userFrom.wallet.getAddressString()
    });

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        if (!transferToWalletTx)
          return;

        let tx = await Promise.promisify(web3.eth.getTransaction)(transferToWalletTx);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      }, 1000);
    });


    let walletsManager = await ctx.contracts.WalletsManager.deployed();
    const price = await walletsManager.getOraclePrice();

    const walletTransferEstimateGasPrice = await wallet.transfer.estimateGas(ctx.users.userTo.wallet.getAddressString(), transferAmount, 'ETH', {
      value: price,
      from: ctx.users.userFrom.wallet.getAddressString()
    });

    let transferTx = await wallet.transfer(ctx.users.userTo.wallet.getAddressString(), transferAmount, 'ETH', {
      value: price,
      from: ctx.users.userFrom.wallet.getAddressString(),
      gas: parseInt(walletTransferEstimateGasPrice * 1.2)
    });

    expect(transferTx.tx).to.be.a('string');

    const walletLog = _.find(transferTx.logs, {event: 'MultisigWalletConfirmationNeeded'});
    expect(walletLog).to.be.an('object');

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        if (!transferTx)
          return;

        let tx = await Promise.promisify(web3.eth.getTransaction)(transferTx.tx);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      }, 1000);
    });

  });

  it('obtain secret', async () => {
    await Promise.delay(10000);

    const keyEncoded = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/secret`,
      body: {
        pubkey: ctx.users.userFrom.wallet.getPublicKey().toString('hex')
      },
      json: true
    });

    ctx.users.userFrom.secret = decryptWithPrivKeyUtil(`0x${ctx.users.userFrom.wallet.getPrivateKey().toString('hex')}`, keyEncoded);
  });

  it('validate secret', async () => {
    await Promise.delay(10000);

    let token = speakeasy.totp({ //client side
      secret: ctx.users.userFrom.secret,
      encoding: 'base32'
    });

    const validateResponse = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/secret/confirm`,
      body: {
        address: ctx.users.userFrom.wallet.getAddressString(),
        token: token
      },
      json: true
    });

    expect(validateResponse.code).to.eq(exchangeMessageFactory.secretValidated.code);

  });

  it('try to obtain secret one more time', async () => {


    const keyEncoded = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/secret`,
      body: {
        pubkey: ctx.users.userFrom.wallet.getPublicKey().toString('hex')
      },
      json: true
    });

    expect(keyEncoded.code).to.eq(exchangeMessageFactory.secretAlreadyValidated.code);
  });

  it('confirm', async () => {

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallets/${ctx.users.userFrom.wallet.getAddressString()}`,
      json: true
    });

    let wallet = ctx.contracts.Wallet.at(walletList[0].address);
    let pendings = await wallet.getPendings();

    let token = speakeasy.totp({ //client sideхмм
      secret: ctx.users.userFrom.secret,
      encoding: 'base32'
    });

    const confirmedTx = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/confirm`,
      body: {
        token: token,
        operation: pendings[1][0],
        wallet: wallet.address
      },
      json: true
    });

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(confirmedTx.hash);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      });
    });
  });

  it('validate balance', async () => {
    const transferAmount = ctx.web3.toWei(1, 'ether');
    const userToBalance = await Promise.promisify(ctx.web3.eth.getBalance)(ctx.users.userTo.wallet.getAddressString());
    expect(userToBalance.toNumber()).to.be.gte(parseInt(transferAmount));
  });

  it('create second wallet', async () => {

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

  it('transfer to second wallet', async () => {
    await Promise.delay(10000);

    const web3 = new Web3(new WalletProvider(ctx.users.userFrom.wallet, ctx.web3.currentProvider));

    ctx.contracts.Wallet.setProvider(web3.currentProvider);
    const transferAmount = ctx.web3.toWei(3, 'ether');

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallets/${ctx.users.userFrom.wallet.getAddressString()}`,
      json: true
    });

    let wallet = ctx.contracts.Wallet.at(walletList[1].address);

    await Promise.promisify(web3.eth.sendTransaction)({
      to: walletList[1].address,
      value: transferAmount,
      gas: 50000,
      from: ctx.users.userFrom.wallet.getAddressString()
    });

    let walletsManager = await ctx.contracts.WalletsManager.deployed();
    const price = await walletsManager.getOraclePrice();

    const walletTransferEstimateGasPrice = await wallet.transfer.estimateGas(ctx.users.userTo.wallet.getAddressString(), transferAmount, 'ETH', {
      value: price,
      from: ctx.users.userFrom.wallet.getAddressString()
    });

    let transferTx = await wallet.transfer(ctx.users.userTo.wallet.getAddressString(), transferAmount, 'ETH', {
      value: price,
      from: ctx.users.userFrom.wallet.getAddressString(),
      gas: parseInt(walletTransferEstimateGasPrice * 1.2)
    });

    expect(transferTx.tx).to.be.a('string');

    const walletLog = _.find(transferTx.logs, {event: 'MultisigWalletConfirmationNeeded'});
    expect(walletLog).to.be.an('object');

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        if (!transferTx)
          return;

        let tx = await Promise.promisify(web3.eth.getTransaction)(transferTx.tx);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      }, 1000);
    });
  });

  it('confirm', async () => {
    await Promise.delay(10000);

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallets/${ctx.users.userFrom.wallet.getAddressString()}`,
      json: true
    });

    let wallet = ctx.contracts.Wallet.at(walletList[1].address);
    let pendings = await wallet.getPendings();

    let token = speakeasy.totp({ //client side
      secret: ctx.users.userFrom.secret,
      encoding: 'base32'
    });

    const confirmedTx = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/confirm`,
      body: {
        token: token,
        operation: pendings[1][0],
        wallet: wallet.address
      },
      json: true
    });

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(confirmedTx.hash);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      });
    });
  });

  it('validate balance again', async () => {
    const transferAmount = ctx.web3.toWei(4, 'ether');
    const userToBalance = await Promise.promisify(ctx.web3.eth.getBalance)(ctx.users.userTo.wallet.getAddressString());
    expect(userToBalance.toNumber()).to.eq(parseInt(transferAmount));
  });

  it('sending 6 ethers to userFrom2 from owner', async () => {

    const userFromTransferAmount = ctx.web3.toWei(6, 'ether');

    let userFromTransferTx = await Promise.promisify(ctx.web3.eth.sendTransaction)({
      to: ctx.users.userFrom2.wallet.getAddressString(),
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

  it('obtain secret for another account', async () => {

    const keyEncoded = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/secret`,
      body: {
        pubkey: ctx.users.userFrom2.wallet.getPublicKey().toString('hex')
      },
      json: true
    });

    ctx.users.userFrom2.secret = decryptWithPrivKeyUtil(`0x${ctx.users.userFrom2.wallet.getPrivateKey().toString('hex')}`, keyEncoded);
  });

  it('validate secret', async () => {
    await Promise.delay(10000);

    let token = speakeasy.totp({ //client side
      secret: ctx.users.userFrom2.secret,
      encoding: 'base32'
    });

    const validateResponse = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/secret/confirm`,
      body: {
        address: ctx.users.userFrom2.wallet.getAddressString(),
        token: token
      },
      json: true
    });

    expect(validateResponse.code).to.eq(exchangeMessageFactory.secretValidated.code);

  });

  it('try to obtain secret one more time', async () => {

    const keyEncoded = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/secret`,
      body: {
        pubkey: ctx.users.userFrom2.wallet.getPublicKey().toString('hex')
      },
      json: true
    });

    expect(keyEncoded.code).to.eq(exchangeMessageFactory.secretAlreadyValidated.code);
  });

  it('create wallet', async () => {

    const web3 = new Web3(new WalletProvider(ctx.users.userFrom2.wallet, ctx.web3.currentProvider));

    ctx.contracts.WalletsManager.setProvider(web3.currentProvider);
    const walletsManager = await ctx.contracts.WalletsManager.deployed();
    const walletCreationEstimateGasPrice = await walletsManager.create2FAWallet.estimateGas(0);

    let createWalletTx = await walletsManager.create2FAWallet(0, {
      from: ctx.users.userFrom2.wallet.getAddressString(),
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

  it('transfer', async () => {
    await Promise.delay(10000);

    const web3 = new Web3(new WalletProvider(ctx.users.userFrom2.wallet, ctx.web3.currentProvider));

    ctx.contracts.Wallet.setProvider(web3.currentProvider);
    const transferAmount = ctx.web3.toWei(1, 'ether');

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallets/${ctx.users.userFrom2.wallet.getAddressString()}`,
      json: true
    });

    let wallet = ctx.contracts.Wallet.at(walletList[0].address);
    let transferToWalletTx = await Promise.promisify(web3.eth.sendTransaction)({
      to: walletList[0].address,
      value: transferAmount,
      gas: 50000,
      from: ctx.users.userFrom2.wallet.getAddressString()
    });

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        if (!transferToWalletTx)
          return;

        let tx = await Promise.promisify(web3.eth.getTransaction)(transferToWalletTx);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      }, 1000);
    });


    let walletsManager = await ctx.contracts.WalletsManager.deployed();
    const price = await walletsManager.getOraclePrice();

    const walletTransferEstimateGasPrice = await wallet.transfer.estimateGas(ctx.users.userTo2.wallet.getAddressString(), transferAmount, 'ETH', {
      value: price,
      from: ctx.users.userFrom2.wallet.getAddressString()
    });

    let transferTx = await wallet.transfer(ctx.users.userTo2.wallet.getAddressString(), transferAmount, 'ETH', {
      value: price,
      from: ctx.users.userFrom2.wallet.getAddressString(),
      gas: parseInt(walletTransferEstimateGasPrice * 1.2)
    });

    expect(transferTx.tx).to.be.a('string');

    const walletLog = _.find(transferTx.logs, {event: 'MultisigWalletConfirmationNeeded'});
    expect(walletLog).to.be.an('object');

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        if (!transferTx)
          return;

        let tx = await Promise.promisify(web3.eth.getTransaction)(transferTx.tx);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      }, 1000);
    });

  });

  it('confirm', async () => {

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallets/${ctx.users.userFrom2.wallet.getAddressString()}`,
      json: true
    });

    let wallet = ctx.contracts.Wallet.at(walletList[0].address);
    let pendings = await wallet.getPendings();

    let token = speakeasy.totp({ //client sideхмм
      secret: ctx.users.userFrom2.secret,
      encoding: 'base32'
    });

    const confirmedTx = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/confirm`,
      body: {
        token: token,
        operation: pendings[1][0],
        wallet: wallet.address
      },
      json: true
    });

    await new Promise(res => {
      let intervalId = setInterval(async () => {
        let tx = await Promise.promisify(ctx.web3.eth.getTransaction)(confirmedTx.hash);
        if (tx.blockNumber) {
          clearInterval(intervalId);
          res();
        }
      });
    });
  });

  it('validate balance', async () => {
    const transferAmount = ctx.web3.toWei(1, 'ether');
    const userToBalance = await Promise.promisify(ctx.web3.eth.getBalance)(ctx.users.userTo2.wallet.getAddressString());
    expect(userToBalance.toNumber()).to.eq(parseInt(transferAmount));
  });

  after(async () => {
    ctx.service2faPid.kill();
    await Promise.delay(10000);
  });
};
