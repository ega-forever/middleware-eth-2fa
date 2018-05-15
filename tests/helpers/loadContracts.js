/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

const config = require('../../config'),
  eventCtrl = require('middleware_eth.chronoSCProcessor/controllers/eventsCtrl');

module.exports = async (provider) => {
  let contracts = {};
  const smEvents = eventCtrl(config.nodered.functionGlobalContext.contracts);

  for (let contract_name in config.nodered.functionGlobalContext.contracts)
    if (config.nodered.functionGlobalContext.contracts.hasOwnProperty(contract_name)) {
      config.nodered.functionGlobalContext.contracts[contract_name].setProvider(provider);
      contracts[contract_name] = await config.nodered.functionGlobalContext.contracts[contract_name].deployed().catch(()=> config.nodered.functionGlobalContext.contracts[contract_name]);
    }
  return {smEvents, contracts};
};
