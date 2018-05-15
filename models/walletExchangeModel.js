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
const WalletExchange = new mongoose.Schema({
  secret: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    required: true
  },
  address: {
    type: String,
    unique: true,
    required: true
  },
  operations: [{type: String}],
  created: {type: Date, required: true, default: Date.now}
});


module.exports = mongoose.model(`${config.mongo.data.collectionPrefix}WalletExchange`, WalletExchange);
