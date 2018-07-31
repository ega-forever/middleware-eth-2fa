const publicKeyConvert = require('secp256k1').publicKeyConvert,
  pubToAddress = require('ethereumjs-util').pubToAddress,
  toChecksumAddress = require('ethereumjs-util').toChecksumAddress;

function decompress(startsWith02Or03) {

  // if already decompressed an not has trailing 04
  const testBuffer = new Buffer(startsWith02Or03, 'hex');
  if (testBuffer.length === 64) startsWith02Or03 = '04' + startsWith02Or03;

  let decompressed = publicKeyConvert(
    new Buffer(startsWith02Or03, 'hex'),
    false
  ).toString('hex');

  // remove trailing 04
  decompressed = decompressed.substring(2);
  return decompressed;
}

module.exports = publicKey => {

  // normalize key
  publicKey = decompress(publicKey);

  const addressBuffer = pubToAddress(new Buffer(publicKey, 'hex'));
  return toChecksumAddress(addressBuffer.toString('hex'));
};