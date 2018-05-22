/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const blockModel = require('../models/blockModel'),
  Promise = require('bluebird');

module.exports = () =>
  new Promise(res => {
    let check = async () => {
      await Promise.delay(10000);
      let genesisBlockExist = await blockModel.count({number: 0});
      genesisBlockExist ?
        res() : check();
    };
    check();
  });
