const { BncClient } = require('@binance-chain/javascript-sdk');
const { AminoPrefix } = require('@binance-chain/javascript-sdk/lib/types');
const { decodeAddress } = require('@binance-chain/javascript-sdk/lib/crypto');
const { BigNumber } = require('bignumber.js');

class Binance {
    constructor(apiClient) {
        this.switchRpc = this.switchRpc.bind(this);
        this.apiClient = apiClient;
    }

    switchRpc() {
        const rpcUrl = `https://dex.binance.org`;
        // const rpcUrl = `${this.apiClient.getApiPath()}/bnb/${this.apiClient.getApiKey()}`;
        return new BncClient(rpcUrl);
    }

    async setNodes(nodes) {
        if (nodes) {
            this.node = nodes[0];
            this.bnbClient = await this.switchRpc();
            this.bnbClient.chooseNetwork('mainnet');
            await this.bnbClient.initChain().then()
                .catch(e => {
                    console.log('error initChain');
                    console.error(e)
                });
        } else {
            this.node = null;
            this.bnbClient = null;
        }
    }

    registerWallet(mnemonic) {
        let bnbAccount;
        if (mnemonic) {
            bnbAccount = this.bnbClient.recoverAccountFromMnemonic(mnemonic)
        } else {
            bnbAccount = this.bnbClient.createAccount();
        }
        return {walletAddress: bnbAccount.address, walletKey: bnbAccount.privateKey};
    }


    addressFromKey(key) {
        const bnbAccount = this.bnbClient.recoverAccountFromPrivateKey(key);
        return bnbAccount.address;
    }

    genTxObj(txS) {
        const dest = [];
        const destItems = [];
        for (let i = 0; i < txS.length; i++) {
            const txObj = txS[i];
            const token = (txObj.tx.coin.code === 'BNB') ? 'BNB' : txObj.tx.coin.contract;
            dest.push({to: txObj.destItem.address,
                coins: [{
                    denom: token,
                    // amount: txObj.tx.value
                    amount: Math.round(new BigNumber(txObj.tx.value).multipliedBy(new BigNumber(10).pow(8)).toNumber()),
                }]
            });
            destItems.push(txObj.destItem);
        }

        return {
            sourceItem: txS[0].sourceItem,
            outputs: dest,
            destItems: destItems,
            token: txS[txS.length-1].tx.coin.code,
            coin: txS[txS.length-1].tx.coin,
            memo: txS[txS.length-1].tx.memo
        };
    }

    async buildTransaction(node, txObj) {
        const srcObj = txObj.sourceItem;
        const aDestItems = txObj.outputs;

        const msg = {
            inputs : [],
            outputs : [],
            aminoPrefix: AminoPrefix.MsgSend
        };

        const signMsg = {
            inputs : [],
            outputs : []
        };

        for (let t of aDestItems) {
            msg.inputs.push({address: decodeAddress(srcObj.address), coins: t.coins});
            msg.outputs.push({address: decodeAddress(t.to), coins: t.coins});
            signMsg.inputs.push({address: srcObj.address, coins: t.coins});
            signMsg.outputs.push({address: t.to, coins: t.coins});
        }

        return { fromAddress: srcObj.address, msg, signMsg, memo: txObj.memo };
    }

    async signTransaction(node, transaction, key) {
        const bnbClient = this.bnbClient;
        await bnbClient.setPrivateKey(key);
        const bnbAccount = bnbClient.recoverAccountFromPrivateKey(key);
        const sequence = await this.apiClient.getTransactionCount('bnb', bnbAccount.address);
        const tx = await bnbClient._prepareTransaction(transaction.msg, transaction.signMsg, transaction.fromAddress,
            sequence, transaction.memo);
        return tx.serialize();
    }

    checkAddress(address) {
        return this.bnbClient.checkAddress(address, 'bnb');
    }
}

module.exports = {
    Binance
};

