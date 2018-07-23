const crypto = require('crypto'),
  secp256k1 = require('secp256k1'),
  EC = require('elliptic').ec,
  ec = new EC('secp256k1');

function aes256CbcEncrypt(iv, key, plaintext) {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const firstChunk = cipher.update(plaintext);
  const secondChunk = cipher.final();
  return Buffer.concat([firstChunk, secondChunk]);
}

function derive(privateKeyA, publicKeyB) {
  let keyA = ec.keyFromPrivate(privateKeyA);
  let keyB = ec.keyFromPublic(publicKeyB);
  let Px = keyA.derive(keyB.getPublic());
  return new Buffer(Px.toArray());
}

function encrypt(publicKeyTo, msg) {

  const keyPair = ec.genKeyPair();
  const ephemPrivateKey = new Buffer(keyPair.getPrivate().toString('hex').slice(32), 'hex');
  const ephemPublicKey = new Buffer(ec.keyFromPrivate(ephemPrivateKey).getPublic("arr"));
  const Px = derive(ephemPrivateKey, publicKeyTo);

  const hash = crypto.createHash("sha512").update(Px).digest();
  const iv = crypto.randomBytes(16);
  const encryptionKey = hash.slice(0, 32);
  const macKey = hash.slice(32);
  const ciphertext = aes256CbcEncrypt(iv, encryptionKey, msg);
  const dataToMac = Buffer.concat([iv, ephemPublicKey, ciphertext]);
  const mac = crypto.createHmac("sha256", macKey).update(dataToMac).digest();
  return {
    iv: iv,
    ephemPublicKey: ephemPublicKey,
    ciphertext: ciphertext,
    mac: mac,
  };
}

module.exports = (publicKey, message)=>{
  const pubString = '04' + publicKey;
  const encryptedBuffers = encrypt(new Buffer(pubString, 'hex'), Buffer(message));

  return {
    iv: encryptedBuffers.iv.toString('hex'),
    ephemPublicKey: encryptedBuffers.ephemPublicKey.toString('hex'),
    ciphertext: encryptedBuffers.ciphertext.toString('hex'),
    mac: encryptedBuffers.mac.toString('hex')
  };
};