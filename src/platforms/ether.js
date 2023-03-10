const Web3 = require('web3');
const bip39 = require('bip39');
const { hdkey } = require('ethereumjs-wallet');
const WalletJS = require('ethereumjs-wallet').default
const ERC20Contract = require('erc20-contract-js');
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const sigUtil = require('eth-sig-util');

const coinGas = 21000;
const tokenGas = 100000; // 60000 for some tokens
const heistGas = 2000000; //1000000;

// TODO use specific chain HD path
const ethHDpath = "m/44'/60'/0'/0";

class EtherPlatform {
    constructor(apiClient, testNodes) {
        this.rpcMap = new Map();
        this.nodesMap = new Map();
        this.apiClient = apiClient;
        this.coinFormat = require('./../blockchain').coinFormat;
        this.convertHexToUtf8 = require('./../blockchain/utils').convertHexToUtf8;
    }

    async setNodes(nodes) {
        this.nodesMap.clear();
        this.rpcMap.clear();

        for (let node of nodes) {
            this.nodesMap.set(node.name, node);
        }
    }

    generateMnemonic(length) {
        const strength = length === 12 ? 128 : 256;
        return bip39.generateMnemonic(strength);
    }

    mnemonicToEntropy(mnemonic) {
        return bip39.mnemonicToEntropy(mnemonic);
    }

    validateMnemonic(mnemonic) {
        return bip39.validateMnemonic(mnemonic);
    }

    entropyToMnemonic(entropy) {
        return bip39.entropyToMnemonic(entropy);
    }

    async mnemonicToSeed(mnemonic) {
        return bip39.mnemonicToSeed(mnemonic);
    }

    async registerWallet(mnemonic, index = 0) {
        const account = await this.walletFromMnemonic(mnemonic, index);
        return { walletAddress: account.address, walletKey: account.privateKey  };
    }

    async walletFromMnemonic(mnemonic, idx = 0) {
        let seed = await bip39.mnemonicToSeed(mnemonic);
        let hdwallet = hdkey.fromMasterSeed(seed);

        let wallet = hdwallet.derivePath(ethHDpath + '/' + idx).getWallet();
        let address = "0x" + wallet.getAddress().toString("hex");
        let privateKey = wallet.getPrivateKey().toString("hex");

        return { address: address, privateKey: privateKey };
    }

    async mnemonicToXpub(mnemonic) {
        let seed = await bip39.mnemonicToSeed(mnemonic);
        let hdwallet = hdkey.fromMasterSeed(seed);
        return  hdwallet.derivePath(ethHDpath).publicExtendedKey();
    }

    addressFromXpub(xpub, index = 0) {
        let hdwallet = hdkey.fromExtendedKey(xpub);
        let wallet = hdwallet.deriveChild(index).getWallet();
        return "0x" + wallet.getAddress().toString("hex");
    }

    addressFromKey(key) {
        const bufKey = Buffer.from(key, 'hex');
        const account = WalletJS.fromPrivateKey(bufKey)
        return account.getChecksumAddressString();
    }

    genTxObj(txS) {
        return txS[0];
    }

    async buildTransaction(node, txObj) {
        const ether = new Web3('ws://localhost:8546');
        const srcObj = txObj.sourceItem;
        const destObj = txObj.destItem;
        const tx = txObj.tx;
        const aValue = tx.value;
        const coin = tx.coin;
        const isErcToken = coin['type'] === 'ERC20';
        let gas = tx.gas || isErcToken ? tokenGas : coinGas;

        let weiValue;
        if (isErcToken) {
            weiValue = this.tokenToWei(coin, aValue);
        } else {
            weiValue = Web3.utils.toWei(this.coinFormat(aValue, 14).toString(), 'ether');
        }

        let txConfig;
        if (isErcToken) {
            const ercContract = new ERC20Contract(ether, coin['contract']);
            const encodedABI = ercContract.transfer(destObj.address, weiValue).encodeABI();
            txConfig = {
                from: srcObj.address,
                to: coin['contract'],
                data: encodedABI,
                gas: heistGas
            };
        } else {
            txConfig = {
                to: destObj.address,
                value: weiValue,
                gas: gas
            };
        }

        txConfig.nonce = await this.apiClient.getTransactionCount(node.name, srcObj.address);
        txConfig.chainId = node.chain_id;

        if (isErcToken) {
            try {
                txConfig.gas = await this.apiClient.estimateGasFee(node.name, txConfig);
            } catch (e) {
                console.log(e);
                txConfig.gas = heistGas;
            }
        }

        return txConfig;
    }

    tokenToWei(coin, aValue) {
        let decimals = coin.satoshi ? Number(coin.satoshi) : 18;
        const dec = coin.decimals || 2;
        decimals -= dec;
        // Decimal
        decimals = Web3.utils.toBN(decimals);
        const value = Math.round(aValue * Math.pow(10, dec));
        const tokenAmount = Web3.utils.toBN(value);
        const poww = Web3.utils.toBN(10).pow(decimals);
        return tokenAmount.mul(poww);
    }

    async signTransaction(node, transaction, key) {
        const address = this.addressFromKey(key);

        const rpc = `${this.apiClient.getApiPath()}/${node.name}/${this.apiClient.getApiKey()}`;
        const ether = new Web3(new Web3.providers.HttpProvider(rpc));

        let gas;
        if (!transaction.gas) {
            gas = await this.apiClient.estimateGasFee(node.name, transaction);
        } else {
            gas = transaction.gas;
        }

        let txFeeGwei;
        try {
            txFeeGwei = await ether.eth.getGasPrice();
        } catch (e) {
            txFeeGwei = 150;
        }

        if (txFeeGwei < 1000) {
            txFeeGwei = Web3.utils.toWei(txFeeGwei.toString(), 'Gwei')
        }

        let nonce;
        if (!transaction.nonce) {
            nonce = await this.apiClient.getTransactionCount(node.name, address);
        } else {
            nonce = transaction.nonce;
        }

        let txObject = {
            nonce: Web3.utils.toHex(nonce),
            to: transaction.to,
            from: address,
            chainId: Web3.utils.toHex(transaction.chainId || node.chain_id),
            value:    Web3.utils.toHex(transaction.value),
            gasPrice: Web3.utils.toHex(txFeeGwei),
            gasLimit: Web3.utils.toHex(gas)
        }

        if (transaction.data) txObject.data = transaction.data;

        console.log(txObject);

        const customCommon = Common.forCustomChain(
            'mainnet',
            {
                name: 'private-blockchain',
                networkId: 123,
                chainId: transaction.chainId || node.chain_id
            },
            'istanbul',
        );

        const tx = new Tx(txObject, { common: customCommon });
        const keyBuff = Buffer.from(key, 'hex');
        try {
            tx.sign(keyBuff);
            return '0x' + tx.serialize().toString('hex');
        } catch (error) {
            throw new Error (`${node.name} Sign TX error ${error.toString()}` );
        }
    }

    async signExtTransaction(params, key, node) {
        const rpc = `${this.apiClient.getApiPath()}/${node.name}/${this.apiClient.getApiKey()}`;
        const ether = new Web3(new Web3.providers.HttpProvider(rpc));

        let txConfig = {
            ...params.txConfig
        }

        const estGas = await this.apiClient.estimateGasFee(node.name, txConfig);
        txConfig.gas = estGas + Math.floor(estGas * 0.2);
        try{
            return await ether.eth.accounts.signTransaction(txConfig, `0x${key}`);
        } catch (e) {
            console.error(e);
        }
    }


    async sendExtTransaction(params, key, node) {
        try {
            let txConfig = {
                ...params.txConfig
            }
            const tx = await this.signTransaction(node, txConfig, key);
            return this.apiClient.broadcastTransaction(node.name, tx);
        } catch (e) {
            console.error(e.toString());
            return null;
        }
    }

    async signExtTypedData(params, key) {
        const msgParams = JSON.parse(params.typedData);
        const keyBuff = Buffer.from(key, 'hex');

        try {
            return sigUtil.signTypedData_v4(keyBuff, {data: msgParams});
        } catch (e) {
            console.error(e.toString());
            return null;
        }
    }

    async signExtMessage(params, key) {
        const ether = new Web3('ws://localhost:8546');

        let msg = this.convertHexToUtf8(params.message);

        try {
            const res = ether.eth.accounts.sign(msg, key);
            return res.signature;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    checkAddress(address) {
        const web = new Web3('ws://localhost:8546');
        let checksumAddress;
        const adr = address.replace(/^xdc/i, '0x');
        // console.log(adr);
        try {
            checksumAddress = web.utils.toChecksumAddress(adr);
        } catch (e) {
            console.warn('invalid ethereum address %s', e.message);
            return false;
        }
        return checksumAddress;
    }

}

exports.EtherPlatform = EtherPlatform;
