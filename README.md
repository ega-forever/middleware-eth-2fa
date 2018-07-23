# middleware-eth-2fa [![Build Status](https://travis-ci.org/ChronoBank/middleware-eth-2fa.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-eth-2fa)

Middleware service for performing 2fa authentication

### Installation

This module is a part of middleware services. You can install it in 2 ways:

1) through core middleware installer  [middleware installer](https://github.com/ChronoBank/middleware)
2) by hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

#### About
This module is used for performing 2fa authentication.
It's also depends from block-processor and chrono-sc-processor.


#### How does it work?
It works like so:
1) user create wallet through the smart contract
2) he activate 2fa through 2fa REST API: the activation happens in 2 steps: At first, user obtain his token through REST API (be careful, in case it hasn't been validated earlier, each time you will obtain new token)
3) user send some money on his created wallet
4) then he validate his operation through 2fa service (via REST API)
5) the 2fa service validates the operation and sends the money to destination user



#### Predefined Routes with node-red flows


The available routes are listed below:

| route | methods | params | description |
| ------ | ------ | ------ | ------ |
| /wallets/:addr   | GET | | return available wallets for the certain address
| /wallet/secret   | POST | ``` {pupkey: <string>} ``` | obtain the secret (TOTP token) for the specified pubkey
| /wallet/secret/confirm   | POST | ``` {address: <string>, token: <string | integer>} ``` | validate and freeze the obtained secret for the specified address. After freeze, you won't be able to to obtain new token for the same account
| /wallet/confirm   | POST | ``` {wallet: <string>, token: <string | integer>, operation: <string>} ``` | confirm the speicifed operation for the specified wallet




##### сonfigure your .env

To apply your configuration, create a .env file in root folder of repo (in case it's not present already).
Below is the expamle configuration:

```
MONGO_ACCOUNTS_URI=mongodb://localhost:27017/data
MONGO_ACCOUNTS_COLLECTION_PREFIX=eth

MONGO_DATA_URI=mongodb://localhost:27017/data
MONGO_DATA_COLLECTION_PREFIX=eth

RABBIT_URI=amqp://localhost:5672
RABBIT_SERVICE_NAME=app_eth

DOMAIN=localhost
REST_PORT=8081

SMART_CONTRACTS_PATH=../node_modules/chronobank-smart-contracts/build/contracts

WEB3_URI=tmp/development/geth.ipc
ORACLE_PRIVATE_KEY=1111111111111
```

The options are presented below:

| name | description|
| ------ | ------ |
| MONGO_URI   | the URI string for mongo connection
| MONGO_COLLECTION_PREFIX   | the default prefix for all mongo collections. The default value is 'eth'
| MONGO_ACCOUNTS_URI   | the URI string for mongo connection, which holds users accounts (if not specified, then default MONGO_URI connection will be used)
| MONGO_ACCOUNTS_COLLECTION_PREFIX   | the collection prefix for accounts collection in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| MONGO_DATA_URI   | the URI string for mongo connection, which holds data collections (for instance, processed block's height). In case, it's not specified, then default MONGO_URI connection will be used)
| MONGO_DATA_COLLECTION_PREFIX   | the collection prefix for data collections in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| RABBIT_URI   | rabbitmq URI connection string
| RABBIT_SERVICE_NAME   | namespace for all rabbitmq queues, like 'app_eth_transaction'
| WEB3_URI | the path to ipc interface
| ORACLE_PRIVATE_KEY | the oracle private key
| SMART_CONTRACTS_PATH | the smart contract's path

License
----
 [GNU AGPLv3](LICENSE)

Copyright
----
LaborX PTY