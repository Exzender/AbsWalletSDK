const baseApiPath = '/v1';
const baseToken = 'CLO';
const baseNetwork = 'clo';
const defaultPassword = process.env.ENC_PASS || '1EbLbZv9s0AsN5AgFb';
const caipMap = new Map([
    ['eip155','ether'],
    // ['cosmos', 'cosmos'], // NOTE unsupported yet
    // ['elrond', 'elrond'], // NOTE unsupported yet
    // ['near', 'near'],     // NOTE unsupported yet
    ['polkadot', 'polka'],
    ['solana', 'solana'],
    ['terra', 'terra'],
    ['tron', 'tron']
]);
const validChains = ['btc','ltc','eth','sol','trx', 'doge'];
const supChains = ['BNB','XRD','LUNA','APT','DOT'];
const chainsPlatforms = new Map([
    ['btc','bitcoin'],
    ['doge','dogecoin'],
    ['ltc','litecoin'],
    ['eth','ether'],
    ['bnb','binance'],
    ['sol','solana'],
    ['trx','tron'],
    ['xrd','radix'],
    ['luna','terra'],
    ['xdc','ether'],
    ['dot','polka'],
    ['apt','aptos']]);
const coreChains = ['clo', 'bsc', 'eth'];


module.exports = { baseApiPath, baseToken, baseNetwork, defaultPassword, caipMap,
    validChains, supChains, chainsPlatforms, coreChains };