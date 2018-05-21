/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * @module config
 * @returns {Object} Configuration
 */
require('dotenv').config();
const path = require('path'),
  contract = require('truffle-contract'),
  speakeasy = require('speakeasy'),
  EthCrypto = require('eth-crypto'),
  WalletProvider = require('../providers'),
  wallet = require('ethereumjs-wallet').fromPrivateKey(Buffer.from(process.env.ORACLE_PRIVATE_KEY, 'hex')),
  requireAll = require('require-all'),
  contracts = requireAll({
    dirname: process.env.SMART_CONTRACTS_PATH ? path.resolve(process.env.SMART_CONTRACTS_PATH) : path.resolve(__dirname, '../node_modules/chronobank-smart-contracts/build/contracts'),
    resolve: Contract => contract(Contract)
  }),
  mongoose = require('mongoose');

const provider = new WalletProvider(wallet, process.env.WEB3_URI || '/tmp/development/geth.ipc');


let config = {
  mongo: {
    accounts: {
      uri: process.env.MONGO_ACCOUNTS_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/data',
      collectionPrefix: process.env.MONGO_ACCOUNTS_COLLECTION_PREFIX || process.env.MONGO_COLLECTION_PREFIX || 'sdk'
    },
    data: {
      uri: process.env.MONGO_DATA_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/data',
      collectionPrefix: process.env.MONGO_DATA_COLLECTION_PREFIX || process.env.MONGO_COLLECTION_PREFIX || 'sdk',
    }
  },
  rest: {
    domain: process.env.DOMAIN || 'localhost',
    port: parseInt(process.env.REST_PORT) || 8081
  },
  nodered: {
    mongo: {
      uri: process.env.NODERED_MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/data',
      collectionPrefix: process.env.NODE_RED_MONGO_COLLECTION_PREFIX || '',
    },
    useLocalStorage: false,
    httpServer: true,
    autoSyncMigrations: process.env.NODERED_AUTO_SYNC_MIGRATIONS || true,
    customNodesDir: [path.join(__dirname, '../')],
    migrationsDir: path.join(__dirname, '../migrations'),
    functionGlobalContext: {
      connections: {
        primary: mongoose
      },
      libs: {
        speakeasy: speakeasy,
        EthCrypto: EthCrypto
      },
      contracts: contracts,
      settings: {
        mongo: {
          accountPrefix: process.env.MONGO_ACCOUNTS_COLLECTION_PREFIX || process.env.MONGO_COLLECTION_PREFIX || 'sdk',
          collectionPrefix: process.env.MONGO_DATA_COLLECTION_PREFIX || process.env.MONGO_COLLECTION_PREFIX || 'sdk'
        },
        rabbit: {
          url: process.env.RABBIT_URI || 'amqp://localhost:5672',
          serviceName: process.env.RABBIT_SERVICE_NAME || 'sdk'
        },
        web3: {
          wallet: wallet,
          provider: provider
        }
      }
    }
  }
};

module.exports = config;
