/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Mongoose model. Used to store hashes, which need to be pinned.
 * @module models/accountModel
 * @returns {Object} Mongoose model
 */

const mongoose = require('mongoose'),
  config = require('../config');

require('mongoose-long')(mongoose);

/**
 * Account model definition
 * @param  {Object} obj Describes account's model
 * @return {Object} Model's object
 */
const UserWalletExchange = new mongoose.Schema({
  owner: {type: String, required: true},
  secret: {type: String, required: true},
  validated: {type: Boolean, default: false, required: true},
  wallets: [{
    address: {type: String},
    created: {type: Date, required: true, default: Date.now}
  }],
  created: {type: Date, required: true, default: Date.now}
});

module.exports = () =>
  mongoose.data.model(`${config.mongo.data.collectionPrefix}UserWalletExchange`, UserWalletExchange);
