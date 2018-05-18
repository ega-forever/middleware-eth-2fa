
module.exports.id = '24.187463b9.50a76c';

const _ = require('lodash'),
  config = require('../config');

/**
 * @description flow 187463b9.50a76c update
 * @param done
 */
   

module.exports.up = function (done) {
  let coll = this.db.collection(`${_.get(config, 'nodered.mongo.collectionPrefix', '')}noderedstorages`);
  coll.update({'path':'187463b9.50a76c','type':'flows'}, {
    $set: {'path':'187463b9.50a76c','body':[{'id':'79640639.9f6918','type':'amqp in','z':'187463b9.50a76c','name':'event input','topic':'app_eth_chrono_sc.walletcreated','iotype':'3','ioname':'events','noack':'0','durablequeue':'0','durableexchange':'0','server':'4d3746a2.c73cd8','servermode':'0','x':80.07638549804688,'y':304.65624618530273,'wires':[['f3bc0ec7.14473','22812a80.b669b6']]},{'id':'6977c3e0.ae05dc','type':'async-function','z':'187463b9.50a76c','name':'open swap','func':'const Web3 = global.get(\'libs.web3\');\nconst web3URI = global.get(\'settings.sidechain.uri\');\nconst middlewareAddress = global.get(\'settings.sidechain.addresses.middleware\');\nconst ownerAddress = global.get(\'settings.sidechain.addresses.owner\');\nconst crypto = global.get(\'libs.crypto\');\n\nconst keyHash = crypto.createHash(\'sha256\').update(msg.payload.key)\n    .digest(\'hex\');\n\n\n\nconst contracts = global.get(\'contracts\');\nconst web3 = new Web3(new Web3.providers.HttpProvider(web3URI));\n\n\ncontracts.ChronoBankPlatform.setProvider(web3.currentProvider);\ncontracts.ERC20Interface.setProvider(web3.currentProvider);\ncontracts.AtomicSwapERC20.setProvider(web3.currentProvider);\n\n\nconst platform = await contracts.ChronoBankPlatform.deployed();\nawait platform.addAssetPartOwner(msg.symbol, middlewareAddress, {from: ownerAddress, gas: 5700000});\nconst tokenAddress = await platform.proxies(msg.symbol);\nconst token = contracts.ERC20Interface.at(tokenAddress);\nconst swapContract = await contracts.AtomicSwapERC20.deployed();\nawait platform.reissueAsset(msg.symbol, msg.value, {from: middlewareAddress});\nawait contracts.ERC20Interface.at(tokenAddress).approve(swapContract.address, msg.value, {from: middlewareAddress, gas: 5700000});\n\nawait swapContract.open(msg.payload.swap_id, msg.value, tokenAddress, msg.address, `0x${keyHash}`, (new Date()).getTime()/1000 + 120, {from: middlewareAddress, gas: 5700000});\n\n\nmsg.payload = {\n    swapId: msg.payload.swap_id\n};\n\n//node.warn(contracts);\n\nreturn msg;','outputs':1,'noerr':11,'x':720.076343536377,'y':304.8680934906006,'wires':[[]]},{'id':'def6fd01.5b8cc','type':'mongo','z':'187463b9.50a76c','model':'','request':'{}','options':'{}','name':'mongo','mode':'1','requestType':'1','dbAlias':'primary','x':507.0799102783203,'y':305.6528491973877,'wires':[[]]},{'id':'22812a80.b669b6','type':'function','z':'187463b9.50a76c','name':'prepare exchange','func':'const prefix = global.get(\'settings.mongo.collectionPrefix\');\nconst speakeasy = global.get(\'libs.speakeasy\');\n\n/*if(msg.amqpMessage)\n    msg.amqpMessage.ackMsg();*/\n\n\nmsg.payload = JSON.parse(msg.payload).payload;\n\nconst secret = speakeasy.generateSecret({length: 20});\n\n\nmsg.payload = {\n    model: `${prefix}WalletExchange`, \n    request: {\n       address: msg.payload.wallet,\n       owner: msg.payload.by,\n       secret: secret.base32\n       }\n};\n\n\nreturn msg;','outputs':1,'noerr':0,'x':309.0694580078125,'y':304.56945037841797,'wires':[['def6fd01.5b8cc']]},{'id':'5db14f2f.82d13','type':'http in','z':'187463b9.50a76c','name':'get wallets','url':'/wallet/:owner','method':'get','upload':false,'swaggerDoc':'','x':67.0173568725586,'y':397.0104064941406,'wires':[['fd1422b4.0c53d']]},{'id':'fd1422b4.0c53d','type':'function','z':'187463b9.50a76c','name':'prepare request','func':'const prefix = global.get(\'settings.mongo.collectionPrefix\');\n\n\nmsg.payload = {\n    model: `${prefix}WalletExchange`, \n    request: {\n       owner: msg.req.params.owner\n       }\n};\n\n\nreturn msg;','outputs':1,'noerr':0,'x':253.07642364501953,'y':398.00695610046387,'wires':[['158578b8.227e97']]},{'id':'158578b8.227e97','type':'mongo','z':'187463b9.50a76c','model':'','request':'{}','options':'{}','name':'mongo','mode':'1','requestType':'0','dbAlias':'primary.data','x':432.017333984375,'y':397.0104064941406,'wires':[['48606ffe.6fdfc']]},{'id':'11a8169f.3c2c39','type':'http response','z':'187463b9.50a76c','name':'','statusCode':'','headers':{},'x':816.076416015625,'y':396.46533012390137,'wires':[]},{'id':'48606ffe.6fdfc','type':'function','z':'187463b9.50a76c','name':'format response','func':'msg.payload = msg.payload.map(item=>({\n    address: item.address,\n    created: item.created\n}));\n\nreturn msg;','outputs':1,'noerr':0,'x':607.0833282470703,'y':397.24306869506836,'wires':[['11a8169f.3c2c39']]},{'id':'4f10423b.4eaa7c','type':'http in','z':'187463b9.50a76c','name':'get key','url':'/swaps/obtain/:swap_id','method':'post','upload':false,'swaggerDoc':'','x':67,'y':495.0104064941406,'wires':[['e13f48c9.b78168']]},{'id':'e13f48c9.b78168','type':'function','z':'187463b9.50a76c','name':'prepare request','func':'const prefix = global.get(\'settings.mongo.collectionPrefix\');\n\nmsg.pubkey = msg.payload.pubkey;\n\nmsg.payload = {\n    model: `${prefix}Exchange`, \n    request: {\n       swap_id: msg.req.params.swap_id\n       }\n};\n\n\nreturn msg;','outputs':1,'noerr':0,'x':247.01734924316406,'y':495.0104064941406,'wires':[['25d007bb.1f4b08']]},{'id':'25d007bb.1f4b08','type':'mongo','z':'187463b9.50a76c','model':'','request':'{}','options':'{}','name':'mongo','mode':'1','requestType':'0','dbAlias':'primary.data','x':415.017333984375,'y':495.0104064941406,'wires':[['d8dbcd84.5a57a']]},{'id':'97141047.7ff0c','type':'http response','z':'187463b9.50a76c','name':'','statusCode':'','headers':{},'x':799.076416015625,'y':494.46533012390137,'wires':[]},{'id':'d8dbcd84.5a57a','type':'async-function','z':'187463b9.50a76c','name':'','func':'const EthCrypto = global.get(\'libs.EthCrypto\');\n\n\nif(!msg.payload.length){\n    msg.payload = {msg: \'swap not found\'};\n    return msg;\n}\n\nconst exchange = msg.payload[0];\n\nconst address = EthCrypto.publicKey.toAddress(msg.pubkey).toLowerCase();\n \n node.warn(address);\n  \nif(exchange.address !== address){\n    msg.payload = {msg: \'wrong pubkey provided\'};\n    return msg;\n}\n\n\nmsg.payload = await EthCrypto.encryptWithPublicKey(msg.pubkey, exchange.key);\n\n\nreturn msg;','outputs':1,'noerr':1,'x':600.2986679077148,'y':495.86811351776123,'wires':[['97141047.7ff0c']]},{'id':'f3bc0ec7.14473','type':'debug','z':'187463b9.50a76c','name':'','active':true,'console':'false','complete':'false','x':302.07640075683594,'y':205.56598663330078,'wires':[]},{'id':'2c9ff553.530daa','type':'function','z':'187463b9.50a76c','name':'format response','func':'const EthCrypto = global.get(\'libs.EthCrypto\');\n\nif(!msg.pubkey){\n    msg.payload = {msg: \'not correct pbkey\'};\n    return msg;\n}\n\nmsg.payload = msg.payload.map(item=>({\n    secret: item.secret,\n    created: item.created\n}));\n\n\n\nconst exchange = msg.payload[0];\n\nconst address = EthCrypto.publicKey.toAddress(msg.pubkey).toLowerCase();\n \n node.warn(address);\n  \nif(exchange.address !== address){\n    msg.payload = {msg: \'wrong pubkey provided\'};\n    return msg;\n}\n\n\nmsg.payload = await EthCrypto.encryptWithPublicKey(msg.pubkey, exchange.key);\n\n\nreturn msg;','outputs':1,'noerr':1,'x':640,'y':620,'wires':[[]]}]}
  }, {upsert: true}, done);
};

module.exports.down = function (done) {
  let coll = this.db.collection(`${_.get(config, 'nodered.mongo.collectionPrefix', '')}noderedstorages`);
  coll.remove({'path':'187463b9.50a76c','type':'flows'}, done);
};
