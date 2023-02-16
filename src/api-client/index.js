const apiRequest = require('./request');

function initApi(apiKey, url, ignoreSsl) {
    apiRequest.initApi(apiKey, url, ignoreSsl);
}

async function getNetworks() {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/info/networks`,
        mediaType: 'application/json'
    });
}

async function getTokens(chain) {
    const path = chain ? `/${chain}` : '';
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/info/tokens${path}`,
        mediaType: 'application/json'
    });
}

async function getTokenInfo(code) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/info/token/${code}`,
        mediaType: 'application/json'
    });
}

async function getBalance(chain, address, token) {
    const tkn = token ? `/${token}` : '';
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/wallet/balance/${chain}/${address}${tkn}`,
        mediaType: 'application/json'
    });
}

async function getTokensOnWallet(chain, address) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/wallet/tokens/balance/${chain}/${address}`,
        mediaType: 'application/json'
    });
}

async function getLastBlock(chain) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/block/current/${chain}`,
        mediaType: 'application/json'
    });
}

async function getBlock(chain, hash) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/block/${chain}/${hash}`,
        mediaType: 'application/json'
    });
}

async function getTransaction(chain, hash) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/transaction/${chain}/${hash}`,
        mediaType: 'application/json'
    });
}

async function getRawTransaction(chain, hash) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/transaction/raw/${chain}/${hash}`,
        mediaType: 'application/json'
    });
}

async function getTransactionCount(chain, address) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/transaction/count/${chain}/${address}`,
        mediaType: 'application/json'
    });
}

async function getFeeRate(chain) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/transaction/fee/rate/${chain}`,
        mediaType: 'application/json'
    });
}

async function estimateGasFee(chain, payload) {
    return apiRequest.apiRequest({
        method: 'POST',
        path: `/v1/transaction/estimategasfee`,
        mediaType: 'application/json',
        body: {
            chain,
            transactionPayload: payload
        }
    });
}

async function getUtxosForAddress(chain, address) {
    return apiRequest.apiRequest({
        method: 'GET',
        path: `/v1/transaction/utxo/${chain}/${address}`,
        mediaType: 'application/json'
    });
}

async function sendTransaction(chain, key, payload) {
    return apiRequest.apiRequest({
        method: 'POST',
        path: `/v1/transaction/sendTransaction`,
        mediaType: 'application/json',
        body: {
            chain,
            privateKey: key,
            transactionPayload: payload
        }
    });
}

async function broadcastTransaction(chain, signedTx) {
    return apiRequest.apiRequest({
        method: 'POST',
        path: `/v1/transaction/broadcastTransaction`,
        mediaType: 'application/json',
        body: {
            chain,
            signedTransaction: signedTx
        }
    });
}

module.exports = {
    initApi,
    getNetworks,
    getTokens,
    getBalance,
    getTokensOnWallet,
    getTokenInfo,
    getLastBlock,
    getBlock,
    getTransaction,
    getRawTransaction,
    getTransactionCount,
    getUtxosForAddress,
    getFeeRate,
    estimateGasFee,
    sendTransaction,
    broadcastTransaction
}