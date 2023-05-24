const { Api, JsonRpc, RpcError } = require('enf-eosjs');
const { TextEncoder, TextDecoder } = require('util');
const { JsSignatureProvider } = require('enf-eosjs/dist/eosjs-jssig');
const { PrivateKey } = require('enf-eosjs/dist/PrivateKey');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
// const apiClient = require("../api-client");

const rpcs = new Map ([
    ['wax', 'https://wax.eu.eosamsterdam.net'],
    ['eos','https://eos.genereos.io']]);

class EosPlatform {
    constructor(platform, apiClient) {
        this.rpcMap = new Map();
        this.apiClient = apiClient;
        this.platform = platform;
        this.coinFormatStr = require('./../blockchain').coinFormatStr;
    }

    async setNodes(nodes) {
        if (nodes) {
            this.node = nodes[0];
            const key = this.node.name;
            const web = await this.switchRpc(this.node);
            this.rpcMap.set(key, web);
        } else {
            this.node = null;
            this.rpcMap.clear();
        }
    }

    async switchRpc(node) {
        // const rpc = `${this.apiClient.getApiPath()}/${this.node.name}/${this.apiClient.getApiKey()}`;
        // console.log('rpc:', rpc);
        return new JsonRpc(rpcs.get(node.name), { fetch });
    }

    async addressFromKey(key, nodeName) {
        let web = this.rpcMap.get(nodeName);
        const pk = PrivateKey.fromString(key);
        const pub = pk.getPublicKey().toString();
        try {
            const result = await web.history_get_key_accounts(pub);
            if (result) {
                if (result['account_names']) {
                    if (result['account_names'].length) {
                        return result['account_names'][0];
                    }
                }
            }
        } catch (e) {
            //
        }
    }

    async registerWallet() {
        // NOTE: not available
    }

    genTxObj(txS) {
        return txS[0];
    }

    async buildTransaction(node, txObj, txName = 'transfer') {
        const srcObj = txObj.sourceItem;
        const destObj = txObj.destItem;
        const tx = txObj.tx;
        const aValue = tx.value;
        const coin = tx.coin;
        const memo = tx.memo || '';

        let txActions;

        const txValue = `${this.coinFormatStr(aValue, coin['satoshi'] || 6)} ${coin.assetName}`;
        // const zeroValue = `0.${'0'.repeat(coin['satoshi'] || 6)} ${coin.assetName}`;

        if (txName === 'transfer') {
            txActions = {
                actions: [{
                    account: coin.contract,
                    name: 'transfer',
                    authorization: [{
                        actor: srcObj.address,
                        permission: 'active',
                    }],
                    data: {
                        from: srcObj.address,
                        to: destObj.address,
                        quantity: txValue,
                        memo: memo
                    },
                }]
            };
        }
        // 'delegatebw', // undelegatebw // buyram // powerup  - not implemented yet
        // else {
        //     txActions = {
        //         actions: [{
        //             account: 'eosio',
        //             name: 'delegatebw',
        //             authorization: [{
        //                 actor: srcObj.address,
        //                 permission: 'active',
        //             }],
        //             data: {
        //                 from: srcObj.address,
        //                 receiver: srcObj.address, // another receiver
        //                 stake_cpu_quantity: txValue,
        //                 stake_net_quantity: zeroValue,
        //                 transfer: false
        //             },
        //         }]
        //     };
        // }

        return txActions;
    }

    async signTransaction(node, transaction, key) {
        const web = this.rpcMap.get(node.name);
        const signature = new JsSignatureProvider([key]);
        const textDecoder = new TextDecoder();
        const api = new Api({
            rpc: web,
            signatureProvider: signature,
            textDecoder: textDecoder,
            textEncoder: new TextEncoder() });
        const resTx = await api.transact(transaction,
            {
                broadcast: false,
                // sign: true,
                blocksBehind: 3,
                expireSeconds: 50  });
        const res = {
            signatures: resTx.signatures,
            serializedTransaction: Buffer.from(resTx.serializedTransaction).toString('base64')
        };
        return JSON.stringify(res);
    }

    async checkAddress(address, nodeName) {
        console.log('checkAddress', nodeName, address);
        const web = this.rpcMap.get(nodeName);

        let noAccount = true;
        try {
            await web.get_account(address);
            noAccount = false;
        } catch (e) {
            console.warn('No EOS account - need to init');
        }

        return !noAccount;
    }
}

exports.EosPlatform = EosPlatform;
