const { LCDClient, Coins, MnemonicKey, RawKey, MsgSend,
    MsgExecuteContract, Fee } = require('@terra-money/terra.js');
const axios = require('axios');

const rpcs = new Map ([
    ['terra', { chainID : 'columbus-5', isClassic: true}],
    ['terra2', {chainID : 'phoenix-1', isClassic: false}]]);

const uluna = 1000000;

class TerraPlatform {
    constructor(apiClient) {
        this.rpcMap = new Map();
        this.nodesMap = new Map();
        this.apiClient = apiClient;
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
        let rpc = rpcObj.RPC || `${this.apiClient.getApiPath()}/${node.name}/${this.apiClient.getApiKey()}`;
        console.log(rpc);
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
        return gasPrices.uluna;// new Coins(gasPrices);
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
        const isToken = !coin.contract;

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
            const denom = coin.contract;
            feeDenom = denom;
            msgSend = new MsgSend(
                srcObj.address,
                destObj.address,
                {[denom]: Math.floor((aValue * uluna)).toString()}
            );
        }

        let options = {
            msgs: [msgSend],
            gasPrices: { uluna: gas },
            gasAdjustment: 1.5,
            feeDenoms: feeDenom
        }
        if (node.name === 'terra') options.fee = new Fee(150000,{ uluna: Math.floor((aValue * 0.01 * uluna)) });
        if (tx.memo) options.memo = tx.memo;

        // console.log(options);
        // const tx = await wallet.createTx(options);
        // const fee = await lcd.tx.estimateGas(tx)

        return options;
    }

    async signTransaction(node, transaction, key) {
        const lcd = this.rpcMap.get(node.name);
        const srckey = Buffer.from(key, 'base64');
        const rawKey = new RawKey(srckey);
        const wallet = lcd.wallet(rawKey);
        try {
            // const tx = await wallet.createTx(transaction);
            // console.log(tx);
            const tx = await  wallet.createAndSignTx(transaction);
            // console.log(JSON.stringify(tx, null, ' '));
            // const encoded = lcd.tx.encode(tx);
            // return Buffer.from(tx.toBytes().buffer).toString('hex');
            return lcd.tx.encode(tx);
        } catch (error) {
            console.log(error);
            throw new Error (`Terra Sign TX error ${error.toString()}` );
        }
    }

    checkAddress(address) {
        return /(terra1[a-z\d]{38})/g.test(address);
    }
}

exports.TerraPlatform = TerraPlatform;
