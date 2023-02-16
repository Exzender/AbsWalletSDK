const aptos = require('aptos');
const bip39 = require('bip39');

const derivePath = `m/44'/637'/0'/0'/0'`;
const rpc = 'https://fullnode.mainnet.aptoslabs.com/v1';

class AptosPlatform {
    constructor() {
        this.rpcMap = new Map();
    }

    async setNodes(nodes) {
        if (nodes) {
            this.node = nodes[0];
            const key = this.node.name;
            const web = await new aptos.AptosClient(rpc);
            this.rpcMap.set(key, web);
        } else {
            this.node = null;
            this.rpcMap.clear();
        }
    }

    addressFromKey(key) {
        const hex = new aptos.HexString(key);
        const account1 = new aptos.AptosAccount(hex.toUint8Array());//, adr);
        return account1.address().toString();
    }

    async registerWallet(mnemonic) {
        let seed = bip39.mnemonicToSeedSync(mnemonic).toString('hex');
        const { key } = aptos.derivePath(derivePath, seed);
        const account1 = new aptos.AptosAccount(new Uint8Array(key));
        return { walletAddress: account1.address().toString(), walletKey: account1.toPrivateKeyObject().privateKeyHex };
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

        const accountHex = new aptos.HexString(srcObj.address);

        try {
            const decimals = coin['satoshi'] ? Number(coin['satoshi']) : 18;
            const poww = Math.pow(10, decimals);
            const wei = Math.floor(aValue * poww);

            const payload = {
                type: 'entry_function_payload',
                function: '0x1::coin::transfer',
                type_arguments: [coin.contract],
                arguments: [new aptos.HexString(destObj.address), wei]
            };
            return web.generateTransaction(accountHex, payload);
        } catch (error) {
            throw new Error (`Aptos Build TX error ${error.toString()}` );
        }
    }

    async signTransaction(node, transaction, key) {
        const web = this.rpcMap.get(node.name);
        const hex = new aptos.HexString(key);
        const account1 = new aptos.AptosAccount(hex.toUint8Array());
        try {
            return web.signTransaction(account1, transaction);
        } catch (error) {
            throw new Error (`Aptos Sign TX error ${error.toString()}` );
        }
    }
}

exports.AptosPlatform = AptosPlatform;
