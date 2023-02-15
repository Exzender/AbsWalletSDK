const apiClient = require('./../api-client');
const { Blockchain } = require('./../blockchain');

let blockchain;

function init (apiKey, url, ignoreSsl) {
    apiClient.initApi(apiKey, url, ignoreSsl);
    blockchain = new Blockchain(apiClient, false);
}

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

function generateMnemonic(length) {
    return blockchain.generateMnemonic(length);
}

async function generateWallet(chain, mnemonic = null, index = 0) {
    const mnemo = mnemonic || blockchain.generateMnemonic();
    let wallet = await blockchain.registerWallet(chain, mnemo, index);
    const xpub = await blockchain.mnemonicToXpub(mnemonic);
    return {address: wallet.walletAddress, xpub, key: wallet.walletKey};
}

async function getNetworks() {
    return apiClient.getNetworks();
}

async function getTokens(chain) {
    return apiClient.getTokens(chain);
}

async function getTokenInfo(code) {
    return apiClient.getTokenInfo(code);
}

async function getBalance(chain, address, token) {
    return apiClient.getBalance(chain, address, token);
}

async function getTokensOnWallet(chain, address) {
    return apiClient.getTokensOnWallet(chain, address);
}

async function addressFromXpub(chain, xpub, index) {
    return blockchain.addressFromXpub(chain, xpub, index);
}

async function addressFromKey(chain, key) {
    return blockchain.addressFromKey(chain, key);
}

async function getLastBlock(chain) {
    return apiClient.getLastBlock(chain);
}

async function getBlock(chain, hash) {
    return apiClient.getBlock(chain, hash);
}

async function getTransaction(chain, hash) {
    return apiClient.getTransaction(chain, hash);
}

async function getTransactionCount(chain, address) {
    return apiClient.getTransactionCount(chain, address);
}

async function sendTransaction(chain, key, payload) {
    return apiClient.sendTransaction(chain, key, payload);
}

async function broadcastTransaction(chain, signedTx) {
    return apiClient.broadcastTransaction(chain, signedTx);
}

async function buildTransaction(chain, payload) {
    return blockchain.buildTransaction(chain, payload);
}

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