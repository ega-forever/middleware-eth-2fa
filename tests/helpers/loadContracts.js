/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

const requireAll = require('require-all'),
  contract = require('truffle-contract'),
  path = require('path');

module.exports = async (provider) => {

  let contractsDeployed = {};

  const contracts = requireAll({
    dirname: process.env.SMART_CONTRACTS_PATH ? path.resolve(process.env.SMART_CONTRACTS_PATH) : path.resolve(__dirname, '../node_modules/chronobank-smart-contracts/build/contracts'),
    resolve: Contract => {
      let con = contract(Contract);
      con.setProvider(provider);
      return con;
    }
  });

  for (let contract_name in contracts)
    if (contracts.hasOwnProperty(contract_name))
      try {
        contractsDeployed[contract_name] = await contracts[contract_name].deployed();
      } catch (e) {
        contractsDeployed[contract_name] = contracts[contract_name];
      }

  return contractsDeployed;
};
