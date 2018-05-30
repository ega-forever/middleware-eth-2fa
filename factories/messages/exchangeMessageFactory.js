/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

module.exports = {
  wrongPubKey: {code: 400, message: 'wrong pubkey provided'},
  secretAlreadyValidated: {code: 401, message: 'the secret key has already been validated!'},
  walletNotFound: {code: 402, message: 'wallet not found'},
  wrongToken: {code: 403, message: 'wrong token provided'},
  secretValidated: {code: 404, message: 'secret validated!'}
};
