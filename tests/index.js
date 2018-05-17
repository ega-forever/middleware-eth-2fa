/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const config = require('../config'),
  mongoose = require('mongoose'),
  speakeasy = require('speakeasy'),
  EthCrypto = require('eth-crypto'),
  Promise = require('bluebird');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const expect = require('chai').expect,
  Wallet = require('ethereumjs-wallet'),
  request = require('request-promise'),
  net = require('net'),
  //awaitLastBlock = require('./helpers/awaitLastBlock'),
  clearQueues = require('./helpers/clearQueues'),
  //connectToQueue = require('./helpers/connectToQueue'),
  //consumeMessagesUntil = require('./helpers/consumeMessagesUntil'),
  loadContracts = require('./helpers/loadContracts'),
  //executeAddCBE = require('./helpers/executeAddCBE'),
  _ = require('lodash'),
  Web3 = require('web3'),
  amqp = require('amqplib');

const ctx = {};

describe('core/2fa', function () {

  before(async () => {
    ctx.amqpInstance = await amqp.connect(config.nodered.functionGlobalContext.settings.rabbit.url);
    await clearQueues(ctx.amqpInstance);

    const providerSet = /http:\/\//.test(process.env.WEB3_URI) ?
      new Web3.providers.HttpProvider(process.env.WEB3_URI) :
      new Web3.providers.IpcProvider(`${/^win/.test(process.platform) ? '\\\\.\\pipe\\' : ''}${process.env.WEB3_URI}`, net);


    ctx.web3 = new Web3(providerSet);
    ctx.contracts = await loadContracts(providerSet);

    const userFromPrivateKey = '993130d3dd4de71254a94a47fdacb1c9f90dd33be8ad06b687bd95f073514a97'; //accounts[1]
    const userFromWallet = Wallet.fromPrivateKey(Buffer.from(userFromPrivateKey, 'hex'));
    const userAddress = `0x${userFromWallet.getAddress().toString('hex')}`;

    const userToBalance = await Promise.promisify(ctx.web3.eth.getBalance)('0xa7c6c244e37ebaf1a9cc54a0ce74024ceec6cde9');

    ctx.users = {
      oracle: {
        address: '0x294f3c4670a56441f3133835a5cbb8baaf010f88'
      },
      userFrom: {
        wallet: userFromWallet,
        address: userAddress
      },
      userTo: {
        address: '0xa7c6c244e37ebaf1a9cc54a0ce74024ceec6cde9',
        balance: userToBalance
      }
    };

    //return await awaitLastBlock(ctx.web3);
  });

  after(() => {
    ctx.web3.currentProvider.connection.end();
    return mongoose.disconnect();
  });

  afterEach(async () => {
    await clearQueues(ctx.amqpInstance);
  });

  it('set oracle address and price', async () => {

    const contractOracle = await ctx.contracts.WalletsManager.getOracleAddress();
    if (contractOracle !== ctx.users.oracle.address)
      await ctx.contracts.WalletsManager.setOracleAddress(ctx.users.oracle.address, {from: ctx.users.oracle.address});

    const price = await ctx.contracts.WalletsManager.getOraclePrice();

    if (price.toString() === '0')
      await ctx.contracts.WalletsManager.setOraclePrice(10, {from: ctx.users.oracle.address});

  });

  it('create wallet', async () => {

    let createWalletTx = await ctx.contracts.WalletsManager.create2FAWallet(0, {
      from: ctx.users.userFrom.address,
      gas: 5700000
    });

    expect(createWalletTx.tx).to.be.a('string');

    const walletLog = _.find(createWalletTx.logs, {event: 'WalletCreated'});
    expect(walletLog).to.be.an('object');
  });

  it('transfer', async () => {
    await Promise.delay(20000);

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallet/${ctx.users.userFrom.address}`,
      json: true
    });

    const transferAmount = ctx.web3.toWei(10, 'ether');

    let wallet = ctx.contracts.Wallet.at(walletList[0].address);

    await Promise.promisify(ctx.web3.eth.sendTransaction)({to: walletList[0].address, value: transferAmount, from: ctx.users.userFrom.address});


    let transferTx = await wallet.transfer(ctx.users.userTo.address, transferAmount, 'ETH', {
      value: transferAmount,
      from: ctx.users.userFrom.address,
      gas: 5700000
    });

    expect(transferTx.tx).to.be.a('string');

    const walletLog = _.find(transferTx.logs, {event: 'MultisigWalletConfirmationNeeded'});
    expect(walletLog).to.be.an('object');

  });

  it('confirm', async () => {
    await Promise.delay(20000);

    let walletList = await request({
      uri: `http://localhost:${config.rest.port}/wallet/${ctx.users.userFrom.address}`,
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

    const secret = await EthCrypto.decryptWithPrivateKey(`0x${ctx.users.userFrom.wallet.getPrivateKey().toString('hex')}`, keyEncoded);

    let token = speakeasy.totp({ //client side
      secret: secret,
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

    const transferAmount = ctx.web3.toWei(10, 'ether');
    const userToBalance = await Promise.promisify(ctx.web3.eth.getBalance)(ctx.users.userTo.address);
    expect(userToBalance.toNumber()).to.eq(ctx.users.userTo.balance.toNumber() + parseInt(transferAmount));
  });

});
