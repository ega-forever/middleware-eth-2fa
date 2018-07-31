const WalletProvider = require('../providers'),
  Wallet = require('ethereumjs-wallet');

let wallet = null;

module.exports = () => {
  if (!wallet){
    wallet = Wallet.fromPrivateKey(Buffer.from(process.env.ORACLE_PRIVATE_KEY, 'hex'));
    wallet.provider = new WalletProvider(wallet, process.env.WEB3_URI || '/tmp/development/geth.ipc');
  }

  return wallet;
};

