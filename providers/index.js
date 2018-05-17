const ProviderEngine = require('web3-provider-engine'),
  FiltersSubprovider = require('web3-provider-engine/subproviders/filters.js'),
  WalletSubprovider = require('ethereumjs-wallet/provider-engine'),
  Web3Subprovider = require('web3-provider-engine/subproviders/web3.js'),
  Web3 = require('web3'),
  net = require('net');

function WalletProvider (wallet, uri) {
  this.wallet = wallet;
  this.address = `0x${this.wallet.getAddress().toString('hex')}`;

  this.engine = new ProviderEngine();

  this.engine.addProvider(new WalletSubprovider(this.wallet, {}));
  this.engine.addProvider(new FiltersSubprovider());


  const provider = /http:\/\//.test(uri) ?
    new Web3.providers.HttpProvider(uri) :
    new Web3.providers.IpcProvider(`${/^win/.test(process.platform) ? '\\\\.\\pipe\\' : ''}${uri}`, net);

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
