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


module.exports = { baseApiPath, baseToken, baseNetwork, defaultPassword, caipMap };