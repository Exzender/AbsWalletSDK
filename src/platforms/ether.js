const Web3 = require('web3');
const bip39 = require('bip39');
const { hdkey } = require('ethereumjs-wallet');
const WalletJS = require('ethereumjs-wallet').default
const ERC20Contract = require('erc20-contract-js');
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;

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

    async addressFromXpub(xpub, index = 0) {
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
        // const ether = this.rpcMap.get(node.name);
        const address = this.addressFromKey(key);
        let txObject = {
            nonce: Web3.utils.toHex(transaction.nonce),
            to: transaction.to,
            from: address,
            chainId: Web3.utils.toHex(transaction.chainId),
            value:    Web3.utils.toHex(transaction.value),
            gasPrice: Web3.utils.toHex(Web3.utils.toWei('20', 'Gwei')),
            gasLimit: Web3.utils.toHex(transaction.gas)
        }
        if (transaction.data) txObject.data = transaction.data;
        console.log(txObject);

        // const common = new Common('mainnet');

        const customCommon = Common.forCustomChain(
            'mainnet',
            {
                name: 'private-blockchain',
                networkId: 123,
                chainId: transaction.chainId
            },
            'istanbul',
        );

        const tx = new Tx(txObject, { common: customCommon });
        const keyBuff = Buffer.from(key, 'hex');
        try {
            tx.sign(keyBuff);
            // console.log(tx.toJSON());
            return '0x' + tx.serialize().toString('hex');
        } catch (error) {
            throw new Error (`${node.name} Sign TX error ${error.toString()}` );
        }
    }
}

exports.EtherPlatform = EtherPlatform;
