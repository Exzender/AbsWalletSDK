const apiClient = require('./../api-client');
const { Blockchain } = require('./../blockchain');

let blockchain;

/**
 * API client and blockchain module init - called on getting SDK object
 * @returns undefined
 */
function init (apiKey, url, ignoreSsl) {
    apiClient.initApi(apiKey, url, ignoreSsl);
    blockchain = new Blockchain(apiClient, false);
}

/**
 * Get blockchain nodes/tokens information from API and configures each supported blockchain for later use
 * @returns {Promise<undefined>}
 */
async function initBlockchain() {
    try {
        const networks = await apiClient.getNetworks();
        await blockchain.initNodes(networks);

        const tokens = await apiClient.getTokens();
        await blockchain.initCoins(tokens);
    } catch (error) {
        throw new Error (`Init Blockchains error ${error.toString()}` );
    }
}

/**
 * Generates mnemonic. May accept mnemonic length (12 or 24 words).
 * @param {string} [length] (24 by default)
 * @returns {string} mnemonic phrase
 */
function generateMnemonic(length) {
    return blockchain.generateMnemonic(length);
}

/**
 * Generates Wallet. May accept mnemonic length (12 or 24 words).
 * @param {string} chain blockchain name
 * @param {string} [mnemonic] if omitted - random mnemonic will be generated
 * @param {number} [index=0] address index for EVM-based chains
 * @returns {Promise<object>} wallet
 */
async function generateWallet(chain, mnemonic = undefined, index = 0) {
    const mnemo = mnemonic || blockchain.generateMnemonic();
    let wallet = await blockchain.registerWallet(chain, mnemo, index);
    const xpub = await blockchain.mnemonicToXpub(mnemonic);
    return {address: wallet.walletAddress, xpub, key: wallet.walletKey, mnemonic: mnemo};
}

/**
 * Get list of supported networks from API
 * @returns {Promise<array<object>>} supported networks
 */
async function getNetworks() {
    return apiClient.getNetworks();
}

/**
 * Get list of supported tokens from API
 * Currently SDK (and API) can work only with listed/known tokens
 * @param {string} [chain] blockchain name - to get tokens only for specific chain
 * @returns {Promise<array<object>>} supported tokens
 */
async function getTokens(chain) {
    return apiClient.getTokens(chain);
}

/**
 * Get extended info for specific token from API
 * @param {string} code token code - token ID from getTokens request
 * @returns {Promise<object>} token info
 */
async function getTokenInfo(code) {
    return apiClient.getTokenInfo(code);
}

/**
 * Get wallet/address balance from blockchain
 * @param {string} chain blockchain name
 * @param {string} address wallet address
 * @param {string} token token code or contract address
 * @returns {Promise<array<object>>} balance info includes token (name, contract) and value
 */
async function getBalance(chain, address, token) {
    return apiClient.getBalance(chain, address, token);
}

/**
 * Get all known tokens/balances on wallet/address
 * @param {string} chain blockchain name
 * @param {string} address wallet address
 * @returns {Promise<array<object>>} balance info includes token (name, contract) and value
 */
async function getTokensOnWallet(chain, address) {
    return apiClient.getTokensOnWallet(chain, address);
}

/**
 * Generate wallet address form provided XPUB
 * @param {string} chain blockchain name
 * @param {string} xpub XPUB key
 * @param {number} index address index
 * @returns {string} address
 */
function addressFromXpub(chain, xpub, index) {
    return blockchain.addressFromXpub(chain, xpub, index);
}

/**
 * Generate wallet address form private key
 * Processed locally without sending KEY over the internet
 * @param {string} chain blockchain name
 * @param {string} key private key
 * @returns {string} address
 */
function addressFromKey(chain, key) {
    return blockchain.addressFromKey(chain, key);
}

/**
 * Queries last block number from blockchain
 * @param {string} chain blockchain name
 * @returns {Promise<number>} block
 */
async function getLastBlock(chain) {
    return apiClient.getLastBlock(chain);
}

/**
 * Queries last block number from blockchain
 * @param {string} chain blockchain name
 * @param {string} hash block hash or block number
 * @returns {Promise<Object>} block information
 */
async function getBlock(chain, hash) {
    return apiClient.getBlock(chain, hash);
}

/**
 * Queries transaction information by hash from blockchain
 * @param {string} chain blockchain name
 * @param {string} hash transaction hash
 * @returns {Promise<Object>} transaction information
 */
async function getTransaction(chain, hash) {
    return apiClient.getTransaction(chain, hash);
}

/**
 * Queries transactions count for address from blockchain
 * Nonce - for EVM-based chains or Sequence for BNB chain
 * @param {string} chain blockchain name
 * @param {string} address transaction hash
 * @returns {Promise<number>} transaction count
 */
async function getTransactionCount(chain, address) {
    return apiClient.getTransactionCount(chain, address);
}

/**
 * Send transaction to blockchain
 * @param {string} chain blockchain name
 * @param {string} key private key
 * @param {object} payload transaction params
 * see details in API
 * {@link https://devcore.absolutewallet.com/api-docs#/transaction/post_transaction_sendTransaction}
 * @returns {Promise<string>} transaction hash or error
 */
async function sendTransaction(chain, key, payload) {
    return apiClient.sendTransaction(chain, key, payload);
}

/**
 * Broadcast signed and serialized transaction to blockchain
 * @param {string} chain blockchain name
 * @param {string} signedTx signed and serialized transaction
 * @returns {Promise<string>} transaction hash or error
 */
async function broadcastTransaction(chain, signedTx) {
    return apiClient.broadcastTransaction(chain, signedTx);
}

/**
 * Prepares unsigned transaction
 * @param {string} chain blockchain name
 * @param {object} payload transaction params (same as for sendTransaction)
 * @returns {Promise<object>} unsigned transaction
 */
async function buildTransaction(chain, payload) {
    return blockchain.buildTransaction(chain, payload);
}

/**
 * Sign transaction prepared in buildTransaction
 * Processed locally without sending KEY over the internet
 * @param {string} chain blockchain name
 * @param {object} transaction unsigned transaction
 * @param {string} key private key
 * @returns {Promise<string>} signed and serialized transaction
 */
async function signTransaction(chain, transaction, key) {
    return blockchain.signTransaction(chain, transaction, key);
}

module.exports = {
    init,
    generateMnemonic,
    generateWallet,
    getNetworks,
    getTokens,
    getTokenInfo,
    getBalance,getTokensOnWallet,
    addressFromXpub,
    addressFromKey,
    initBlockchain,
    getLastBlock,
    getBlock,
    getTransaction,
    getTransactionCount,
    sendTransaction,
    broadcastTransaction,
    buildTransaction,
    signTransaction,
}