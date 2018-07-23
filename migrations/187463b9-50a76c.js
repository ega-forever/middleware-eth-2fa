
module.exports.id = '187463b9.50a76c';

const _ = require('lodash'),
  config = require('../config');

/**
 * @description flow 187463b9.50a76c update
 * @param done
 */
   

module.exports.up = function (done) {
  let coll = this.db.collection(`${_.get(config, 'nodered.mongo.collectionPrefix', '')}noderedstorages`);
  coll.update({"path":"187463b9.50a76c","type":"flows"}, {
    $set: {"path":"187463b9.50a76c","body":[{"id":"79640639.9f6918","type":"amqp in","z":"187463b9.50a76c","name":"event input","topic":"${config.rabbit.serviceName}_chrono_sc.walletcreated","iotype":"3","ioname":"events","noack":"0","durablequeue":"0","durableexchange":"0","server":"","servermode":"1","x":96.07638549804688,"y":185.65624618530273,"wires":[["5c541665.61f708","e3677b34.9173d8"]]},{"id":"def6fd01.5b8cc","type":"mongo","z":"187463b9.50a76c","model":"","request":"{}","options":"{}","name":"mongo","mode":"1","requestType":"1","dbAlias":"primary.data","x":990,"y":160,"wires":[["de8643d2.8f6ac"]]},{"id":"22812a80.b669b6","type":"function","z":"187463b9.50a76c","name":"prepare exchange","func":"const prefix = global.get('settings.mongo.collectionPrefix');\nconst speakeasy = global.get('libs.speakeasy');\n\nconst userWallet = msg.payload[0];\n\nconst secret = speakeasy.generateSecret({length: 20});\n\nmsg.payload = {\n    model: `${prefix}UserWalletExchange`, \n    request: userWallet ? [\n        {owner: msg.by},\n        {\n            $push: {\n                wallets: {\n                    address: msg.wallet,\n                    created: Date.now()\n                }\n            }\n        }\n        ] : {\n       owner: msg.by,\n       secret: secret.base32,\n       wallets: [\n           {address: msg.wallet, created: Date.now()}\n           ]\n       }\n    };    \n    \n    \n\n\n\n\n\nreturn msg;","outputs":1,"noerr":0,"x":681,"y":184,"wires":[["9a42b33c.456ab"]]},{"id":"de8643d2.8f6ac","type":"function","z":"187463b9.50a76c","name":"ack message","func":"if(msg.amqpMessage)\n    msg.amqpMessage.ackMsg();\n\n\nreturn msg;","outputs":1,"noerr":0,"x":1190,"y":180,"wires":[[]]},{"id":"58b388bb.ccb698","type":"catch","z":"187463b9.50a76c","name":"","scope":null,"x":100,"y":280,"wires":[["cbc68299.d89f4","319f10b8.ca43a"]]},{"id":"cbc68299.d89f4","type":"debug","z":"187463b9.50a76c","name":"","active":true,"console":"false","complete":"error","x":261.06944274902344,"y":363.56949615478516,"wires":[]},{"id":"329f045d.ef4bfc","type":"mongo","z":"187463b9.50a76c","model":"","request":"{}","options":"{}","name":"mongo","mode":"1","requestType":"0","dbAlias":"primary.data","x":496,"y":184,"wires":[["22812a80.b669b6"]]},{"id":"5c541665.61f708","type":"function","z":"187463b9.50a76c","name":"prepare query","func":"const prefix = global.get('settings.mongo.collectionPrefix');\nconst speakeasy = global.get('libs.speakeasy');\n\nmsg.payload = JSON.parse(msg.payload).payload;\nmsg.wallet = msg.payload.wallet;\nmsg.by = msg.payload.by;\n\nmsg.payload = {\n    model: `${prefix}UserWalletExchange`, \n    request: {\n       owner: msg.payload.by\n       }\n};\n\n\nreturn msg;","outputs":1,"noerr":0,"x":300,"y":185,"wires":[["329f045d.ef4bfc"]]},{"id":"319f10b8.ca43a","type":"async-function","z":"187463b9.50a76c","name":"nack message","func":"const Promise = global.get('libs.Promise');\n\nawait Promise.delay(30000);\nif(msg.amqpMessage)\n    msg.amqpMessage.nackMsg();\n\n\nreturn msg;","outputs":1,"noerr":3,"x":300,"y":280,"wires":[[]]},{"id":"9a42b33c.456ab","type":"switch","z":"187463b9.50a76c","name":"","property":"payload.request.length","propertyType":"msg","rules":[{"t":"null"},{"t":"nnull"}],"checkall":"true","outputs":2,"x":867,"y":184,"wires":[["def6fd01.5b8cc"],["c21103a8.1c7a1"]]},{"id":"c21103a8.1c7a1","type":"mongo","z":"187463b9.50a76c","model":"","request":"{}","options":"{}","name":"mongo","mode":"1","requestType":"2","dbAlias":"primary.data","x":990,"y":220,"wires":[["de8643d2.8f6ac"]]},{"id":"e3677b34.9173d8","type":"debug","z":"187463b9.50a76c","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"false","x":360,"y":80,"wires":[]}]}
  }, {upsert: true}, done);
};

module.exports.down = function (done) {
  let coll = this.db.collection(`${_.get(config, 'nodered.mongo.collectionPrefix', '')}noderedstorages`);
  coll.remove({"path":"187463b9.50a76c","type":"flows"}, done);
};
