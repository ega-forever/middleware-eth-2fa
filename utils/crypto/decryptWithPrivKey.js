const crypto = require('crypto'),
  secp256k1 = require('secp256k1'),
  EC = require('elliptic').ec,
  ec = new EC('secp256k1');

function equalConstTime(b1, b2) {
  if (b1.length !== b2.length) {
    return false;
  }
  let res = 0;
  for (let i = 0; i < b1.length; i++) {
    res |= b1[i] ^ b2[i];  // jshint ignore:line
  }
  return res === 0;
}

function aes256CbcDecrypt(iv, key, ciphertext) {
  const cipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const firstChunk = cipher.update(ciphertext);
  const secondChunk = cipher.final();
  return Buffer.concat([firstChunk, secondChunk]);
}

function derive(privateKeyA, publicKeyB) {
  let keyA = ec.keyFromPrivate(privateKeyA);
  let keyB = ec.keyFromPublic(publicKeyB);
  let Px = keyA.derive(keyB.getPublic());
  return new Buffer(Px.toArray());
}

function decrypt(privateKey, opts) {

  const Px = derive(privateKey, opts.ephemPublicKey);
  const hash = crypto.createHash("sha512").update(Px).digest();
  const encryptionKey = hash.slice(0, 32);
  const macKey = hash.slice(32);
  const dataToMac = Buffer.concat([
    opts.iv,
    opts.ephemPublicKey,
    opts.ciphertext
  ]);
  const realMac = crypto.createHmac("sha256", macKey).update(dataToMac).digest();
  if(!equalConstTime(opts.mac, realMac))
    throw new Error("Bad MAC");
  return aes256CbcDecrypt(opts.iv, encryptionKey, opts.ciphertext);


}

module.exports = (privateKey, encrypted) => {

  if (privateKey.indexOf('0x') === 0)
    privateKey = privateKey.replace('0x', '');

  const encryptedBuffer = {
    iv: new Buffer(encrypted.iv, 'hex'),
    ephemPublicKey: new Buffer(encrypted.ephemPublicKey, 'hex'),
    ciphertext: new Buffer(encrypted.ciphertext, 'hex'),
    mac: new Buffer(encrypted.mac, 'hex')
  };

  return decrypt(privateKey, encryptedBuffer).toString();

};