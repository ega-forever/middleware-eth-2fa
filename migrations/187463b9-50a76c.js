
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
    $set: {"path":"187463b9.50a76c","body":[{"id":"79640639.9f6918","type":"amqp in","z":"187463b9.50a76c","name":"event input","topic":"${config.rabbit.serviceName}_chrono_sc.walletcreated","iotype":"3","ioname":"events","noack":"0","durablequeue":"0","durableexchange":"0","server":"","servermode":"1","x":100,"y":180,"wires":[["22812a80.b669b6"]]},{"id":"22812a80.b669b6","type":"function","z":"187463b9.50a76c","name":"prepare exchange","func":"const prefix = global.get('settings.mongo.collectionPrefix');\nconst data = JSON.parse(msg.payload).payload;\n\nmsg.payload = {\n    model: `${prefix}UserWalletExchange`, \n    request: [\n        {owner: data.by},\n        {\n            $set: {\n              owner: data.by  \n            },\n            $push: {\n                wallets: {\n                    address: data.wallet,\n                    created: Date.now()\n                }\n            }\n        },\n        {upsert: true, setDefaultsOnInsert: true}\n        ]\n    };    \n    \n\nreturn msg;","outputs":1,"noerr":0,"x":290,"y":180,"wires":[["c21103a8.1c7a1"]]},{"id":"de8643d2.8f6ac","type":"function","z":"187463b9.50a76c","name":"ack message","func":"if(msg.amqpMessage)\n    msg.amqpMessage.ackMsg();\n\n\nreturn msg;","outputs":1,"noerr":0,"x":710,"y":180,"wires":[[]]},{"id":"58b388bb.ccb698","type":"catch","z":"187463b9.50a76c","name":"","scope":null,"x":100,"y":280,"wires":[["cbc68299.d89f4","319f10b8.ca43a"]]},{"id":"cbc68299.d89f4","type":"debug","z":"187463b9.50a76c","name":"","active":true,"console":"false","complete":"error","x":261.06944274902344,"y":363.56949615478516,"wires":[]},{"id":"319f10b8.ca43a","type":"async-function","z":"187463b9.50a76c","name":"nack message","func":"const Promise = global.get('libs.Promise');\n\nawait Promise.delay(30000);\nif(msg.amqpMessage)\n    msg.amqpMessage.nackMsg();\n\n\nreturn msg;","outputs":1,"noerr":3,"x":300,"y":280,"wires":[[]]},{"id":"c21103a8.1c7a1","type":"mongo","z":"187463b9.50a76c","model":"","request":"{}","options":"{}","name":"mongo","mode":"1","requestType":"2","dbAlias":"primary.data","x":490,"y":180,"wires":[["de8643d2.8f6ac"]]}]}
  }, {upsert: true}, done);
};

module.exports.down = function (done) {
  let coll = this.db.collection(`${_.get(config, 'nodered.mongo.collectionPrefix', '')}noderedstorages`);
  coll.remove({"path":"187463b9.50a76c","type":"flows"}, done);
};
