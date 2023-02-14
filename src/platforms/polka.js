const { ApiPromise, WsProvider, HttpProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { TypeRegistry } = require('@polkadot/types');
const bip39 = require('bip39');

const rpcs = new Map ([
    ['polka', 'wss://rpc.polkadot.io'],
    ['kusama','wss://kusama-rpc.polkadot.io'],
    ['acala','wss://acala-rpc-3.aca-api.network/ws']]);

class PolkaPlatform {
    constructor() {
        this.rpcMap = new Map();
        this.nodesMap = new Map();
        this.registry = new TypeRegistry();
        this.convertAddress = this.convertAddress.bind(this);
    }

    async setNodes(nodes) {
        this.nodesMap.clear();
        this.rpcMap.clear();

        for (let node of nodes) {
            this.nodesMap.set(node.name, node);
            this.node = nodes[0];
            const key = node.name;
            let provider =  new WsProvider(rpcs.get(node.name));
            const web = await ApiPromise.create({ provider, noInitWarn: true });
            this.rpcMap.set(key, web);
        }
    }

    convertAddress(address, chainId) {
        const keyring = new Keyring();
        const pair = keyring.addFromAddress(address, {}, 'ed25519');
        keyring.setSS58Format(chainId);
        return pair.address;
    }

    addressFromKey(key) {
        const mm = bip39.entropyToMnemonic(key);
        const keyring = new Keyring();
        keyring.setSS58Format(0);
        const pair = keyring.addFromMnemonic(mm, {}, 'ed25519');
        return pair.address;
    }

    async registerWallet(mnemonic) {
        const entropy = bip39.mnemonicToEntropy(mnemonic);
        const keyring = new Keyring();
        keyring.setSS58Format(0);
        const pair = keyring.addFromMnemonic(mnemonic, {}, 'ed25519');
        return { walletAddress: pair.address, walletKey: entropy };
    }

    genTxObj(txS) {
        return txS[0];
    }

    async buildTransaction(node, txObj) {
        const web = this.rpcMap.get(node.name);
        const destObj = txObj.destItem;
        const tx = txObj.tx;
        const aValue = tx.value;
        const coin = tx.coin;

        try {
            const wei = Math.floor(aValue * coin.satoshi);
            let tx;
            if (coin.tokenType) {
                tx = await web.tx.currencies.transfer(
                    destObj.address,
                    { [coin.tokenType]: coin.tokenContract },
                    wei);
            } else {
                tx = await web.tx.balances.transfer(destObj.address, wei);
            }
            return tx;
        } catch (error) {
            throw new Error (`Polka Build TX error ${error.toString()}` );
        }
    }

    getKeyPair(key) {
        const keyring = new Keyring();
        keyring.setSS58Format(0);
        const mnemonic = bip39.entropyToMnemonic(key);
        return keyring.addFromMnemonic(mnemonic, {}, 'ed25519');
    }

    async signTransaction(node, transaction, key) {
        const pair = this.getKeyPair(key);
        try {
            return transaction.signAsync(pair);
        } catch (error) {
            throw new Error (`${node.name} Sign TX error ${error.toString()}` );
        }
    }
}

exports.PolkaPlatform = PolkaPlatform;
