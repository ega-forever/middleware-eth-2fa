/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const config = require('../config'),
  speakeasy = require('speakeasy'),
  WalletProvider = require('../providers'),
  EthCrypto = require('eth-crypto'),
  Promise = require('bluebird');

const expect = require('chai').expect,
  Wallet = require('ethereumjs-wallet'),
  request = require('request-promise'),
  awaitLastBlock = require('./helpers/awaitLastBlock'),
  clearQueues = require('./helpers/clearQueues'),
  _ = require('lodash'),
  Web3 = require('web3'),
  amqp = require('amqplib');

const ctx = {};

describe('core/2fa', function () {

  before(async () => {
    ctx.amqpInstance = await amqp.connect(config.nodered.functionGlobalContext.settings.rabbit.url);
    await clearQueues(ctx.amqpInstance);

    ctx.contracts = config.nodered.functionGlobalContext.contracts;

    ctx.users = {
      owner: {
        wallet: Wallet.fromPrivateKey(Buffer.from(process.env.OWNER_PRIVATE_KEY, 'hex'))
      },
      middleware: {
        wallet: config.nodered.functionGlobalContext.settings.web3.wallet
      },
      userFrom: {
        wallet: Wallet.generate('1234')
      },
      userTo: {
        wallet: Wallet.generate('5678')
      }
    };

    ctx.users.owner.web3 = new Web3(new WalletProvider(ctx.users.owner.wallet, process.env.WEB3_URI || '/tmp/development/geth.ipc'));
    ctx.users.userFrom.web3 = new Web3(new WalletProvider(ctx.users.userFrom.wallet, process.env.WEB3_URI || '/tmp/development/geth.ipc'));
    ctx.users.userTo.web3 = new Web3(new WalletProvider(ctx.users.userTo.wallet, process.env.WEB3_URI || '/tmp/development/geth.ipc'));
    ctx.users.middleware.web3 = new Web3(new WalletProvider(ctx.users.middleware.wallet, process.env.WEB3_URI || '/tmp/development/geth.ipc'));

    //return await awaitLastBlock();
  });

  after(() => {
  });

  afterEach(async () => {
    await clearQueues(ctx.amqpInstance);
  });

  it('validating users balances has enough ethers', async () => {

    ctx.users.userFrom.balance = await Promise.promisify(ctx.users.userFrom.web3.eth.getBalance)(ctx.users.userFrom.wallet.getAddressString());
    ctx.users.userTo.balance = await Promise.promisify(ctx.users.userTo.web3.eth.getBalance)(ctx.users.userTo.wallet.getAddressString());
    ctx.users.owner.balance = await Promise.promisify(ctx.users.owner.web3.eth.getBalance)(ctx.users.owner.wallet.getAddressString());
    ctx.users.middleware.balance = await Promise.promisify(ctx.users.middleware.web3.eth.getBalance)(ctx.users.middleware.wallet.getAddressString());

    expect(ctx.users.userFrom.balance.toNumber()).to.eq(0);
    expect(ctx.users.userTo.balance.toNumber()).to.eq(0);
    expect(ctx.users.owner.balance.toNumber()).to.be.above(parseInt(ctx.users.owner.web3.toWei(2, 'ether')));

  });

  it('sending 2 ethers to userFrom from owner', async () => {
    const userFromTransferAmount = ctx.users.userFrom.web3.toWei(2, 'ether');
    let userFromTranserTx = await Promise.promisify(ctx.users.owner.web3.eth.sendTransaction)({
      to: ctx.users.userFrom.wallet.getAddressString(),
      value: userFromTransferAmount,
      from: ctx.users.owner.wallet.getAddressString()
    });

    let tx = await Promise.promisify(ctx.users.owner.web3.eth.getTransaction)(userFromTranserTx);
    if (tx.blockNumber)
      return;

    let latestFilter = ctx.users.owner.web3.eth.filter('latest');

    await new Promise(res => {
      latestFilter.watch(async function (error) {
        if (error)
          return;
        let tx = await Promise.promisify(ctx.users.owner.web3.eth.getTransaction)(userFromTranserTx);
        if (tx.blockNumber) {
          await new Promise(res => latestFilter.stopWatching(res));
          res();
        }
      });
    });
  });

  it('validating userFrom balance', async () => {
    ctx.users.userFrom.balance = await Promise.promisify(ctx.users.userFrom.web3.eth.getBalance)(ctx.users.userFrom.wallet.getAddressString());
    expect(ctx.users.userFrom.balance.toNumber()).to.eq(parseInt(ctx.users.owner.web3.toWei(2, 'ether')));

  });

  it('set oracle address and price', async () => {

    ctx.contracts.WalletsManager.setProvider(ctx.users.owner.web3.currentProvider);
    ctx.contracts.Wallet.setProvider(ctx.users.owner.web3.currentProvider);

    let walletsManager = await ctx.contracts.WalletsManager.deployed();
    const contractOracle = await walletsManager.getOracleAddress();

    if (contractOracle !== ctx.users.middleware.wallet.getAddressString()) {
      const setOracleAddressTxEstimateGas = await walletsManager.setOracleAddress.estimateGas(ctx.users.middleware.wallet.getAddressString());

      const setOracleAddressTx = await walletsManager.setOracleAddress(ctx.users.middleware.wallet.getAddressString(), {
        from: ctx.users.owner.wallet.getAddressString(),
        gas: parseInt(setOracleAddressTxEstimateGas * 1.2)
      });

      expect(setOracleAddressTx.tx).to.be.a('string');

      const latestFilter = ctx.users.owner.web3.eth.filter('latest');

      await new Promise(res => {
        latestFilter.watch(async function (error) {
          if (error)
            return;
          let tx = await Promise.promisify(ctx.users.owner.web3.eth.getTransaction)(setOracleAddressTx.tx);
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

    ctx.contracts.WalletsManager.setProvider(ctx.users.userFrom.web3.currentProvider);
    const walletsManager = await ctx.contracts.WalletsManager.deployed();

    const walletCreationEstimateGasPrice = await walletsManager.create2FAWallet.estimateGas(0);

    let createWalletTx = await walletsManager.create2FAWallet(0, {
      from: ctx.users.userFrom.wallet.getAddressString(),
      gas: parseInt(walletCreationEstimateGasPrice * 1.5)
    });

    expect(createWalletTx.tx).to.be.a('string');

    const latestFilter = ctx.users.userFrom.web3.eth.filter('latest');

    await new Promise(res => {
      latestFilter.watch(async function (error) {
        if (error)
          return;
        let tx = await Promise.promisify(ctx.users.userFrom.web3.eth.getTransaction)(createWalletTx.tx);
        if (tx.blockNumber) {
          await new Promise(res => latestFilter.stopWatching(res));
          res();
        }
      });
    });

    const walletLog = _.find(createWalletTx.logs, {event: 'WalletCreated'});
    expect(walletLog).to.be.an('object');
  });

  it('transfer', async () => {
    await Promise.delay(30000);

    ctx.contracts.Wallet.setProvider(ctx.users.userFrom.web3.currentProvider);
    const transferAmount = ctx.users.userFrom.web3.toWei(1, 'ether');

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallet/${ctx.users.userFrom.wallet.getAddressString()}`,
      json: true
    });

    let wallet = ctx.contracts.Wallet.at(walletList[0].address);

    await Promise.promisify(ctx.users.userFrom.web3.eth.sendTransaction)({
      to: walletList[0].address,
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

    const latestFilter = ctx.users.userFrom.web3.eth.filter('latest');

    await new Promise(res => {
      latestFilter.watch(async function (error) {
        if (error)
          return;
        let tx = await Promise.promisify(ctx.users.userFrom.web3.eth.getTransaction)(transferTx.tx);
        if (tx.blockNumber) {
          await new Promise(res => latestFilter.stopWatching(res));
          res();
        }
      });
    });
  });

  it('obtain secret', async () => {
    await Promise.delay(10000);

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallet/${ctx.users.userFrom.wallet.getAddressString()}`,
      json: true
    });

    let walletWithPendingOperation = _.find(walletList, wallet => wallet.operations.length);

    const keyEncoded = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/${walletWithPendingOperation.address}`,
      body: {
        pubkey: ctx.users.userFrom.wallet.getPublicKey().toString('hex')
      },
      json: true
    });

    ctx.users.userFrom.secret = await EthCrypto.decryptWithPrivateKey(`0x${ctx.users.userFrom.wallet.getPrivateKey().toString('hex')}`, keyEncoded);
  });

  it('try to obtain secret one more time', async () => {
    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallet/${ctx.users.userFrom.wallet.getAddressString()}`,
      json: true
    });

    let walletWithPendingOperation = _.find(walletList, wallet => wallet.operations.length);

    const keyEncoded = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/${walletWithPendingOperation.address}`,
      body: {
        pubkey: ctx.users.userFrom.wallet.getPublicKey().toString('hex')
      },
      json: true
    });

    expect(keyEncoded.msg).to.eq('the secret key has already been obtained!');

  });

  it('confirm', async () => {

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallet/${ctx.users.userFrom.wallet.getAddressString()}`,
      json: true
    });

    let walletWithPendingOperation = _.find(walletList, wallet => wallet.operations.length);

    let token = speakeasy.totp({ //client side
      secret: ctx.users.userFrom.secret,
      encoding: 'base32'
    });

    const confirmedTx = await request({
      method: 'POST',
      uri: `http://localhost:${config.rest.port}/wallet/${walletWithPendingOperation.address}/confirm`,
      body: {
        token: token,
        operation: walletWithPendingOperation.operations[0]
      },
      json: true
    });

    const walletLog = _.find(confirmedTx.logs, {event: 'MultisigWalletMultiTransact'});
    expect(walletLog).to.be.an('object');
  });

  it('validate balance', async () => {
    await Promise.delay(10000);

    const transferAmount = ctx.users.userTo.web3.toWei(1, 'ether');
    const userToBalance = await Promise.promisify(ctx.users.userTo.web3.eth.getBalance)(ctx.users.userTo.wallet.getAddressString());
    expect(userToBalance.toNumber()).to.eq(parseInt(transferAmount));
  });

});
