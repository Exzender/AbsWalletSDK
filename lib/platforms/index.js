const { Binance } = require('./binance');
const { EtherPlatform } = require('./ether');
const { TronPlatform } = require('./tron');
const { Bitcoin } = require('./bitcoin');
const { RadixPlatform } = require('./radix');
const { SolanaPlatform } = require('./solana');
const { TerraPlatform } = require('./terra');
const { PolkaPlatform } = require('./polka');
const { AptosPlatform } = require('./aptos');
const { EosPlatform } = require('./eos');


module.exports = {
    Binance,
    EtherPlatform,
    TronPlatform,
    Bitcoin,
    RadixPlatform,
    SolanaPlatform,
    TerraPlatform,
    PolkaPlatform,
    AptosPlatform,
    EosPlatform
};
