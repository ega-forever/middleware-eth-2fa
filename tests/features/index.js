/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const models = require('../../models'),
  config = require('../../config'),
  _ = require('lodash'),
  expect = require('chai').expect,
  Promise = require('bluebird'),
  spawn = require('child_process').spawn;

module.exports = (ctx) => {

  before(async () => {
    await models.userWalletExchangeModel.remove({});
  });

  it('validating users balances has enough ethers', async () => {

    ctx.users.userFrom.balance = await Promise.promisify(ctx.users.userFrom.web3.eth.getBalance)(ctx.users.userFrom.wallet.getAddressString());
    ctx.users.userTo.balance = await Promise.promisify(ctx.users.userTo.web3.eth.getBalance)(ctx.users.userTo.wallet.getAddressString());
    ctx.users.owner.balance = await Promise.promisify(ctx.users.owner.web3.eth.getBalance)(ctx.users.owner.wallet.getAddressString());
    ctx.users.middleware.balance = await Promise.promisify(ctx.users.middleware.web3.eth.getBalance)(ctx.users.middleware.wallet.getAddressString());

    expect(ctx.users.userFrom.balance.toNumber()).to.eq(0);
    expect(ctx.users.userTo.balance.toNumber()).to.eq(0);
    expect(ctx.users.owner.balance.toNumber()).to.be.above(parseInt(ctx.users.owner.web3.toWei(6, 'ether')));

  });


  it('sending 6 ethers to userFrom from owner', async () => {
    const userFromTransferAmount = ctx.users.userFrom.web3.toWei(6, 'ether');
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
    expect(ctx.users.userFrom.balance.toNumber()).to.eq(parseInt(ctx.users.owner.web3.toWei(6, 'ether')));

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


};
