/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

module.exports = async (accountFrom, accountTo, contracts) => {
  return await contracts.UserManagerInstance.addCBE(
    accountTo, 0x0, {
      from: accountFrom,
      gas: 3000000
    });
};
