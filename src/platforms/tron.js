const TronWeb = require('tronweb');

const apiKey = process.env.TRON_API_KEY;

class TronPlatform {
    constructor(apiClient) {
        this.rpcMap = new Map();
        this.apiClient = apiClient;
        this.switchRpc = this.switchRpc.bind(this);
        this.addressFromKey = this.addressFromKey.bind(this);
    }

    async setNodes(nodes) {
        if (nodes[0]) {
            this.node = nodes[0];
            const key = this.node.name;
            const tronWeb = this.switchRpc(this.node);
            this.rpcMap.set(key, tronWeb);
        } else {
            this.node = null;
            this.rpcMap.clear();
        }
    }

    async registerWallet(mnemonic) {
        // const testNet = false;

        const web = this.rpcMap.get('trx');
        const account = mnemonic
            ? await  web.fromMnemonic(mnemonic)
            : await  web.createAccount();

        return { walletAddress: account.address, walletKey: account.privateKey };
    }

    addressFromKey(key) {
        const web = this.rpcMap.get('trx');
        const str = key.replace(/^0x/gi,'');
        return web.address.fromPrivateKey(str);
    }

    switchRpc() {
        const privateKey = '';
        let rpcUrl = `${this.apiClient.getApiPath()}/${this.node.name}/${this.apiClient.getApiKey()}`;
        const web = new TronWeb({fullHost: rpcUrl,  privateKey: privateKey});
        web.setHeader({ 'TRON-PRO-API-KEY': apiKey });
        return web;
    }

    genTxObj(txS) {
        return txS[0];
    }

    async buildTransaction(node, txObj) {
        const web = this.rpcMap.get(node.name);
        const srcObj = txObj.sourceItem;
        const destObj = txObj.destItem;
        const tx = txObj.tx;
        const aValue = tx.value;
        const coin = tx.coin;
        const isErcToken = coin.tokenType === 'TRC20';
        const isTrc10Token = coin.tokenType === 'TRC10';

        let txConfig;

        try {

            if (isErcToken) {
                const decimals = coin['satoshi'] ? Number(coin['satoshi']) : 18;
                const poww = Math.pow(10, decimals);
                const weiValue = (aValue * poww).toString();
                const receiverAddress = destObj.address;
                const parameter = [
                    { type: 'address', value: receiverAddress },
                    { type: 'uint256', value: weiValue },
                ];
                const options = { feeLimit: 1000000000, callValue: 0 };

                txConfig = (
                    await web.transactionBuilder.triggerSmartContract(
                        web.address.toHex(coin.tokenContract),
                        'transfer(address,uint256)',
                        options,
                        parameter,
                        web.address.toHex(srcObj.address)
                    )
                ).transaction;
            } else if (isTrc10Token) {
                const decimals = coin['satoshi'] ? Number(coin['satoshi']) : 18;
                const poww = Math.pow(10, decimals);
                const weiValue = (aValue * poww).toString();
                txConfig = await web.transactionBuilder.sendToken(
                    destObj.address,
                    weiValue,
                    coin.tokenID.toString(),
                    srcObj.address
                );
            } else {
                const weiValue = web.toSun(aValue);
                txConfig = await web.transactionBuilder.sendTrx(
                    destObj.address,
                    weiValue,
                    srcObj.address
                );
            }
        } catch (error) {
            throw new Error (`Tron Build TX error ${error.toString()}` );
        }

        return txConfig;

    }

    async signTransaction(node, transaction, key) {
        const web = this.rpcMap.get(node.name);
        const fixKey = key.replace(/^0x/g,'')
        try {
            const signed =  (await web.trx.sign(transaction, fixKey));//.raw_data_hex;
            // console.log(signed);
            return JSON.stringify(signed);
        } catch (error) {
            throw new Error (`Tron Sign TX error ${error.toString()}` );
        }
    }

    async signExtMessage(params, key) {
        const web = this.rpcMap.get('trx');
        if (!web) return 0;

        const signedtxn = await web.trx.signMessageV2(params.message, key);
        return {signature: signedtxn};
    }

    async signExtTransaction(params, key) {
        const web = this.rpcMap.get('trx');
        if (!web) return 0;

        const fixKey = key.replace(/^0x/g,'');

        const signedtxn = await web.trx.sign(params.txConfig.transaction, fixKey);
        return {result: signedtxn}
    }

    checkAddress() {
        return true;
    }
}

exports.TronPlatform = TronPlatform;
