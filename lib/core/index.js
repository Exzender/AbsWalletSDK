'use strict';
const apiClient = require('./../api-client');
const { Blockchain } = require('./../blockchain');
const fs = require('fs');
const { isPathExists } = require('./../utils');

const homedir = require('os').homedir();

const LOCAL_NODES = 'networks.dat';
const LOCAL_TOKENS = 'tokens.dat';

let blockchain;

function getStoragePath(fileName) {
    return `${homedir}/.abwsdk/${fileName}`;
}

function getLocalData(fileName) {
    const filePath = getStoragePath(fileName);
    if (!fs.existsSync(filePath)) {
        return;
    }

    const data = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
    if (!data) {
        return;
    }

    return data;
}

function storeLocalData(fileName, data) {
    const filePath = getStoragePath(fileName);
    isPathExists(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data));
}


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
 * Nodes/tokens information then stored locally. To refresh information from API set forceRefresh to true
 * @param {boolean} [forceRefresh=false] always get actual networks & tokens list from API
 * @param {boolean} [testnets=false] enable use of test blockchains
 * @returns {Promise<object>} blockchain object if needed direct access to it's functions
 */
async function initBlockchain(forceRefresh = false, testnets = false) {
    try {
        let networks, tokens;
        let update = forceRefresh;

        if (forceRefresh) {
            networks = await apiClient.getNetworks();
            tokens = await apiClient.getTokens();
        } else {
            networks = getLocalData(LOCAL_NODES);
            if (!networks) {
                networks = await apiClient.getNetworks();
                update = true;
            }

            tokens = getLocalData(LOCAL_TOKENS);
            if (!tokens) {
                tokens = await apiClient.getTokens();
                update = true;
            }
        }

        await blockchain.initNodes(networks, testnets);
        await blockchain.initCoins(tokens);

        if (update) {
            storeLocalData(LOCAL_NODES, networks);
            storeLocalData(LOCAL_TOKENS, tokens);
        }

        return blockchain;

    } catch (error) {
        throw new Error (`Init Blockchains error ${error.toString()}` );
    }
}

/**
 * Generates mnemonic. May accept mnemonic length (12 or 24 words).
 * @param {string} [length] (24 by default)
 * @returns {Promise<string>} mnemonic phrase
 */
async function generateMnemonic(length) {
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
    const mnemo = mnemonic || (await blockchain.generateMnemonic());
    let wallet = await blockchain.registerWallet(chain, mnemo, index);
    const xpub = await blockchain.mnemonicToXpub(mnemonic);
    return {address: wallet.walletAddress, xpub, key: wallet.walletKey, mnemonic: mnemo};
}


/**
 * Generate wallets for all chains in one call
 * @param {string} [mnemonic] if omitted - random mnemonic will be generated
 * @returns {Promise<object>} all wallets in one object
 */
async function generateAllWallets(mnemonic) {
    const mnemo = mnemonic || (await blockchain.generateMnemonic());

    let wallets = {mnemonic: mnemo};
    const platforms = new Set();

    const networks = getLocalData(LOCAL_NODES);

    for (const net of networks) {
        if (platforms.has(net.platform)) continue;

        const prefix = net.platform;

        let wallet = await blockchain.registerWallet(net.id, mnemo);
        platforms.add(net.platform);

        wallets[prefix] = {address: wallet.walletAddress, key: wallet.walletKey};
    }

    return wallets;
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
 * @param {string} [token] token code or contract address
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
 * @returns {Promise<string>} address
 */
async function addressFromXpub(chain, xpub, index) {
    return blockchain.addressFromXpub(chain, xpub, index);
}

/**
 * Generate wallet address form private key
 * Processed locally without sending KEY over the internet
 * @param {string} chain blockchain name
 * @param {string} key private key
 * @returns {Promise<string>} address
 */
async function addressFromKey(chain, key) {
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
 * Checks if target Aptos account exists and creates it if not
 * @param {string} address target address
 * @param {string} key source wallet private key
 * @returns {Promise<boolean>} result
 */
async function checkAndCreateAptosAccount(address, key) {
    return blockchain.checkAndCreateAptosAccount(address, key);
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

/**
 * @typedef CheckBalanceResult
 * @property {boolean} result - True if balance is enough
 * @property {string} feeCoin - Name of base coin for provided chain
 * @property {string} message - Text result with name of Token (if it's not enough)
 */

/**
 * Check available balance (including fee) prior sending
 * @param {string} chain blockchain name
 * @param {string} address source wallet address
 * @param {string} token token code or contract address
 * @param {number} value sending value
 * @returns {Promise<CheckBalanceResult>}
 */
async function checkBalanceAndFee(chain, address, token, value) {
    return blockchain.checkBalanceAndFee(chain, address, token, value);
}

/**
 * Direct RPC call
 * Interact with the blockchain directly by connecting to the blockchain node and communicating with it through JSON-RPC
 * @param {string} chain blockchain name
 * @param {string} [method='POST'] method (POST, PUT, GET)
 * @param {object} [body] request params
 * @param {string} [rpcPath] optional path of rpc call
 * @returns {Promise<object>} result of RPC call
 */
async function directRpcCall(chain, method, body, rpcPath) {
    return apiClient.directRpcCall(chain, method, body, rpcPath);
}

/**
 * Return network information by its chain id
 * @param {string|number} chainId string or number ID
 * @returns {Promise<object>} network info
 */
async function getChainById(chainId) {
    return blockchain.getChainById(chainId);
}

/**
 * @typedef AddressValidityResult
 * @property {boolean} result - True if address is valid
 * @property {string} platform - Name of the blockchain platform for such address
 */

/**
 * Check wallet address validity and detect chain platform by address
 * @param {string} address address to check
 * @param {string} [chain] if not set - address will be checked against all known chains
 * @returns {Promise<object>} network info
 */
async function isAddressValid(address, chain) {
    return blockchain.isAddressValid(address, chain);
}

module.exports = {
    init,
    generateMnemonic,
    generateWallet,
    generateAllWallets,
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
    checkAndCreateAptosAccount,
    broadcastTransaction,
    buildTransaction,
    signTransaction,
    checkBalanceAndFee,
    directRpcCall,
    getChainById,
    isAddressValid
}