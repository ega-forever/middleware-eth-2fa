/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

const config = require('../../config');

module.exports = async (amqpInstance) => {
    const channel = await amqpInstance.createChannel();
    await channel.assertQueue(`app_${config.nodered.functionGlobalContext.settings.rabbit.serviceName}.chrono_sc_queue`);
    await channel.purgeQueue(`app_${config.nodered.functionGlobalContext.settings.rabbit.serviceName}.chrono_sc_queue`);
    await channel.unbindQueue(`app_${config.nodered.functionGlobalContext.settings.rabbit.serviceName}.chrono_sc_queue`, 'events', `${config.nodered.functionGlobalContext.settings.rabbit.serviceName}_chrono_sc.*`);
    
};