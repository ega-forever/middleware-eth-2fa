const ProviderEngine = require('web3-provider-engine'),
  FiltersSubprovider = require('web3-provider-engine/subproviders/filters.js'),
  HookedWalletEthTxSubprovider = require('web3-provider-engine/subproviders/hooked-wallet-ethtx'),
  inherits = require('util').inherits,
  Web3Subprovider = require('web3-provider-engine/subproviders/web3.js'),
  Web3 = require('web3'),
  net = require('net');

inherits(WalletSubprovider, HookedWalletEthTxSubprovider);

function WalletSubprovider(wallet, opts = {}) {
  opts.getAccounts = function (cb) {

    cb(null, [wallet.getAddressString()]);
  };

  opts.getPrivateKey = function (address, cb) {
    address !== wallet.getAddressString() ?
      cb(new Error('Account not found')) :
      cb(null, wallet.getPrivateKey());
  };

  WalletSubprovider.super_.call(this, opts);
}

function WalletProvider(wallet, provider) {
  this.wallet = wallet;
  this.address = `0x${this.wallet.getAddress().toString('hex')}`;

  this.engine = new ProviderEngine();

  this.engine.addProvider(new WalletSubprovider(this.wallet));
  this.engine.addProvider(new FiltersSubprovider());

  if (!(provider instanceof Web3.providers.HttpProvider || provider instanceof Web3.providers.IpcProvider))
    provider = /http:\/\//.test(provider) ?
      new Web3.providers.HttpProvider(provider) :
      new Web3.providers.IpcProvider(`${/^win/.test(process.platform) ? '\\\\.\\pipe\\' : ''}${provider}`, net);

  this.engine.addProvider(new Web3Subprovider(provider));
  this.engine.start();

}

WalletProvider.prototype.sendAsync = function () {
  return this.engine.sendAsync(...arguments);
};

WalletProvider.prototype.send = function () {
  return this.engine.send(...arguments);
};

WalletProvider.prototype.getAddress = function () {
  return this.address;
};

module.exports = WalletProvider;
