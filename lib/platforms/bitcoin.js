const btcClient = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const { ECPairFactory } = require('ecpair');
const bip39 = require('bip39');
const coinSelect = require('coinselect');
const coininfo = require('coininfo');
const satoshi = 100000000;

function getNetwork(platform, network) {
    const plt = platform === 'tbitcoin' ? 'bitcoin' : platform;
    const curr = coininfo[plt][network];    //.main;  // .test - for Test network
    const frmt = curr.toBitcoinJS();
    return {
        messagePrefix: '\x19' + frmt.name + ' Signed Message:\n',
        bech32: frmt.bech32,
        bip32: {
            public: frmt.bip32.public,
            private: frmt.bip32.private
        },
        pubKeyHash: frmt.pubKeyHash,
        scriptHash: frmt.scriptHash,
        wif: frmt.wif
    }
}

class Bitcoin {
    constructor(platform, apiClient, network = 'main') {
        this.platform = platform;
        this.networkType = network;
        this.bip32 = BIP32Factory(ecc);
        this.ecpair = ECPairFactory(ecc);
        this.apiClient = apiClient;
    }

    async setNodes(nodes) {
        if (nodes) {
            let node = nodes[0];
            this.node = node;
            this.network = getNetwork(node.platform, this.networkType);
        } else {
            this.node = null;
            this.network = null;
        }
    }

    async registerWallet(mnemonic) {
        return this.registerHDWallet(mnemonic);
    }

    async registerHDWallet(mnemonic) {
        let keyPair;
        if (mnemonic) {
            const seed = await bip39.mnemonicToSeed(mnemonic);
            const node = this.bip32.fromSeed(seed, this.network);
            const wif = node.toWIF();
            keyPair = this.ecpair.fromWIF(wif, this.network);
        } else {
            keyPair = this.ecpair.makeRandom({network: this.network});
        }

        const address = this.addressFromKeypair(keyPair);
        return {walletAddress: address, walletKey: keyPair.toWIF()};
    }

    addressFromKeypair(keyPair) {
        const { address } = this.network.bech32
            ? btcClient.payments.p2wpkh({ pubkey: keyPair.publicKey, network: this.network })
            : btcClient.payments.p2pkh({ pubkey: keyPair.publicKey, network: this.network });
        return address;
    }

    addressFromKey(key) {
        const keyPair = this.ecpair.fromWIF( key,this.network );
        return this.addressFromKeypair(keyPair);
    }

    genTxObj(txS) {
        const dest = [];
        const destItems = [];

        for (let i = 0; i < txS.length; i++) {
            const txObj = txS[i];
            dest.push({address: txObj.destItem.address,
                value: Math.round(txObj.tx.value * satoshi)
            });
            destItems.push(txObj.destItem);
        }

        return  {
            sourceItem: txS[0].sourceItem,
            outputs: dest,
            destItems: destItems,
            coin: txS[txS.length-1].tx.coin
        };
    }

    async buildTransaction(node, txObj) {
        const srcObj = txObj.sourceItem;
        const targets = txObj.outputs;

        try {
            return this.destructureTx(node, srcObj.address, targets);
        } catch (error) {
            throw new Error (`${node.name} Build TX error ${error.toString()}` );
        }
    }

    async destructureTx(node, address, targets) {
        const ins = [];
        const utxos = await this.apiClient.getUtxosForAddress(node.name, address);
        if (!utxos) return;

        let sumUtxo = 0;
        for (let i = 0; i < utxos.length; i++) {
            const utxo = utxos[i];
            const utxoValue =  Number(utxo.value);

            const txPrev = await this.apiClient.getRawTransaction(node.name, utxo.txid);
            if (!txPrev) continue;

            sumUtxo += utxoValue;
            const nonWitness = Buffer.from(txPrev, 'hex');
            ins.push({txid: utxo.txid, vout: utxo.vout, value: utxoValue, nonWitnessUtxo : nonWitness});
        }

        const feeRate = Math.floor((await this.apiClient.getFeeRate(node.name))/2);

        let resObj = coinSelect(ins, targets, feeRate);

        if (!resObj.inputs || !resObj.outputs) {
            let maxValueId = 0;
            let maxValue = 0;
            let sumValues = 0;

            for (let i = 0; i < targets.length; i++) {
                const targetValue = targets[i].value;
                sumValues += targetValue;
                if (targetValue > maxValue) {
                    maxValueId = i;
                    maxValue = targetValue;
                }
            }

            targets[maxValueId].value = sumUtxo - sumValues + maxValue - resObj.fee;
            if (targets[maxValueId].value < 0) {
                targets[maxValueId].value = 0;
            }
            resObj = coinSelect(ins, targets, feeRate);
        }

        if (!resObj.outputs) return ;

        return resObj;
    }

    async signTransaction(node, transaction, key) {
        const { inputs, outputs } = transaction;
        let keyPair = this.ecpair.fromWIF(key, this.network);

        const address = this.addressFromKeypair(keyPair);
        const psbt = new btcClient.Psbt({ network: this.network });

        inputs.forEach(input =>
            psbt.addInput({
                hash: input.txid,
                index: input.vout ,
                nonWitnessUtxo: input.nonWitnessUtxo
            })
        );

        outputs.forEach(item => {
            if (!item.address) item.address = address;
            psbt.addOutput(item);
        });

        psbt.signAllInputs(keyPair);

        const self = this;
        function validator (pubkey, msghash, signature) {
            return self.ecpair.fromPublicKey(pubkey).verify(msghash, signature);
        }

        if (!psbt.validateSignaturesOfAllInputs(validator)) {
            return;
        }

        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction(true);
        return  tx.toHex();
    }

    checkAddress() {  // address
        return true;
    }
}

module.exports = {
    Bitcoin
};
