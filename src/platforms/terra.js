const { LCDClient, Coins, MnemonicKey, RawKey, MsgSend,
    MsgExecuteContract } = require('@terra-money/terra.js');
const axios = require('axios');

const rpcs = new Map ([
    ['terra', {RPC : 'https://columbus-lcd.terra.dev', chainID : 'columbus-5', isClassic: true}],
    ['terra2', {RPC : 'https://lcd.terra.dev', chainID : 'phoenix-1', isClassic: false}]]);

const uluna = 1000000;

class TerraPlatform {
    constructor() {
        this.rpcMap = new Map();
        this.nodesMap = new Map();
        this.switchRpc = this.switchRpc.bind(this);
        this.estimateAllGas = this.estimateAllGas.bind(this);
    }

    async setNodes(nodes) {
        this.nodesMap.clear();
        this.rpcMap.clear();

        for (let node of nodes) {
            this.nodesMap.set(node.name, node);
            this.node = nodes[0];
            const key = node.name;
            const web = await this.switchRpc(node);
            this.rpcMap.set(key, web);
        }
    }

    async switchRpc(node, index = 0) {
        const rpcObj = rpcs.get(node.name);
        let rpc = rpcObj.RPC;
        let id = rpcObj.chainID;
        let isClassic = rpcObj.isClassic;

        const gasPricesCoins = await this.estimateAllGas(id);

        return new LCDClient({
            URL: rpc,
            chainID: id,
            gasPrices: gasPricesCoins,
            gasAdjustment: "1.5",
            gas: 10000000,
            isClassic: !!isClassic
        });
    }

    async registerWallet(mnemonic) {
        const lcd = this.rpcMap.get('terra');
        const mk = mnemonic ? new MnemonicKey(mnemonic) : new MnemonicKey();
        const wallet = lcd.wallet(mk);
        return { walletAddress: wallet.key.accAddress, walletKey: wallet.key.privateKey.toString('base64') };
    }

    addressFromKey(key) {
        const lcd = this.rpcMap.get('terra');
        const keyLoc = Buffer.from(key, 'base64');
        const rawKey = new RawKey(keyLoc);
        const wallet = lcd.wallet(rawKey);
        return wallet.key.accAddress;
    }

    async estimateAllGas(id) {
        const prfx = this.getUrlPrefix(id);
        const gasPrices = (await axios(`https://${prfx}-fcd.terra.dev/v1/txs/gas_prices`)).data;
        return  new Coins(gasPrices);
    }

    getUrlPrefix(id) {
        const reg = /([a-z])\w+/i;
        const match = reg.exec(id);
        return  match[0];
    }

    genTxObj(txS) {
        return txS[0];
    }

    async buildTransaction(node, txObj) {
        const lcd = this.rpcMap.get(node.name);
        const srcObj = txObj.sourceItem;
        const destObj = txObj.destItem;
        const tx = txObj.tx;
        const aValue = tx.value;
        const coin = tx.coin;
        const isToken = !coin.denom;

        let gas = await this.estimateAllGas(lcd.config.chainID);
        let feeDenom = 'uluna';
        let msgSend;

        if (isToken) {
            const weiValue = Math.floor(aValue * Math.pow(10, coin.satoshi));
            msgSend = new MsgExecuteContract(srcObj.address, coin.tokenContract,
                {
                    transfer: {
                        amount: (weiValue).toString(),
                        recipient: destObj.address
                    }
                });
        } else {
            const denom = coin.denom;
            feeDenom = denom;
            msgSend = new MsgSend(
                srcObj.address,
                destObj.address,
                {[denom]: Math.floor((aValue * uluna)).toString()}
            );
        }

        let options = {
            msgs: [msgSend],
            gasPrices: gas,
            gasAdjustment: 1.5,
            feeDenoms: feeDenom
        }
        if (tx.memo) options.memo = tx.memo;

        return options;
    }

    async signTransaction(node, transaction, key) {
        const lcd = this.rpcMap.get(node.name);
        const srckey = Buffer.from(key, 'base64');
        const rawKey = new RawKey(srckey);
        const wallet = lcd.wallet(rawKey);
        try {
            return  wallet.createAndSignTx(transaction);
        } catch (error) {
            throw new Error (`Terra Sign TX error ${error.toString()}` );
        }
    }
}

exports.TerraPlatform = TerraPlatform;
