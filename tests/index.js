/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');
process.env.LOG_LEVEL = 'error';

const config = require('../config'),
  models = require('../models'),
  fs = require('fs-extra'),
  spawn = require('child_process').spawn,
  exec = require('child_process').exec,
  Wallet = require('ethereumjs-wallet'),
  //fuzzTests = require('./fuzz'),
  //performanceTests = require('./performance'),
  featuresTests = require('./features'),
  //blockTests = require('./blocks'),
  Promise = require('bluebird'),
  path = require('path'),
  Web3 = require('web3'),
  dbPath = path.join(__dirname, './utils/node/testrpc_db'),
  contractBuildPath = path.join(__dirname, 'node_modules/chronobank-smart-contracts/build'),
  mongoose = require('mongoose'),
  amqp = require('amqplib'),
  WalletProvider = require('../providers'),
  ctx = {};

mongoose.Promise = Promise;
mongoose.data = mongoose.createConnection(config.mongo.accounts.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri, {useMongoClient: true});


describe('core/2fa', function () {

  before(async () => {
    models.init();

    ctx.amqp = {};
    ctx.amqp.instance = await amqp.connect(config.nodered.functionGlobalContext.settings.rabbit.url);
    ctx.amqp.channel = await ctx.amqp.instance.createChannel();
    await ctx.amqp.channel.assertExchange('events', 'topic', {durable: false});


    await fs.remove(dbPath);
    //ctx.nodePid = spawn('node', ['ipcConverter.js'], {env: process.env, stdio: 'ignore'});
    ctx.nodePid = spawn('node', ['tests/utils/node/ipcConverter.js'], {env: process.env, stdio: 'inherit'});
    await Promise.delay(5000);
    await fs.remove(contractBuildPath);

    const { stdout, stderr } = await Promise.promisify(exec)('node ../truffle/build/cli.bundled.js migrate', {env: process.env, stdio: 'inherit', cwd: 'node_modules/chronobank-smart-contracts'});


    await Promise.delay(10000);

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

    ctx.users.owner.web3 = new Web3(new WalletProvider(ctx.users.owner.wallet, process.env.WEB3_TEST_URI || process.env.WEB3_URI || '/tmp/development/geth.ipc'));
    ctx.users.userFrom.web3 = new Web3(new WalletProvider(ctx.users.userFrom.wallet, process.env.WEB3_TEST_URI || process.env.WEB3_URI || '/tmp/development/geth.ipc'));
    ctx.users.userTo.web3 = new Web3(new WalletProvider(ctx.users.userTo.wallet, process.env.WEB3_TEST_URI || process.env.WEB3_URI || '/tmp/development/geth.ipc'));
    ctx.users.middleware.web3 = new Web3(new WalletProvider(ctx.users.middleware.wallet, process.env.WEB3_TEST_URI || process.env.WEB3_URI || '/tmp/development/geth.ipc'));

  });

  after(async () => {
    mongoose.disconnect();
    mongoose.accounts.close();
    await ctx.amqp.instance.close();
    ctx.nodePid.kill();
  });


  //describe('block', () => blockTests(ctx));

  //describe('performance', () => performanceTests(ctx));

  //describe('fuzz', () => fuzzTests(ctx));

  describe('features', () => featuresTests(ctx));

});
