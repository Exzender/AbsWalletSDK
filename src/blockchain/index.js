/**
 * Module with Blockchain functions
 */
const WAValidator = require('multicoin-address-validator');

const { Binance, EtherPlatform, AptosPlatform, Bitcoin, PolkaPlatform,
    RadixPlatform, SolanaPlatform, TerraPlatform, TronPlatform } = require('./../platforms');
const { coinFormat } = require('./utils');
const { validChains, supChains, chainsPlatforms } = require('./../const');

class Blockchain  {
    constructor(apiClient, testNodes = false) {
        this.platformMap = new Map();
        this.nodesMap = new Map();
        this.groupNodes = new Map();
        this.coinsMap = new Map();
        this.platformInit = new Map();
        this.coinsContractsMap = new Map();
        this.apiClient = apiClient;
        // this.apiClient = apiClient;

        /** Binance (BNB, TWT) **/
        const binance = new Binance(apiClient);
        this.platformMap.set('binance', binance);

        /** Ethereum (ETH, ETC, CLO) **/
        const ether = new EtherPlatform(apiClient, testNodes);
        this.platformMap.set('ether', ether);

        /** Tron (TRX) **/
        const tron = new TronPlatform(apiClient);
        this.platformMap.set('tron', tron);

        /** Solana (SOL) **/
        const sol = new SolanaPlatform(apiClient);
        this.platformMap.set('solana', sol);

        /** Radix (XRD) **/
        const rdx = new RadixPlatform();
        this.platformMap.set('radix', rdx);

        /** Terra (classic, 2.0) **/
        const terra = new TerraPlatform(apiClient);
        this.platformMap.set('terra', terra);

        /** PolkaDot **/
        const polka = new PolkaPlatform();
        this.platformMap.set('polka', polka);

        /** Aptos **/
        const aptos = new AptosPlatform(apiClient);
        this.platformMap.set('aptos', aptos);

        /** Bitcoin (BTC, LTC) **/
        const bitcoin = new Bitcoin('bitcoin', apiClient);
        this.platformMap.set('bitcoin', bitcoin);

        const litecoin = new Bitcoin( 'litecoin', apiClient);
        this.platformMap.set('litecoin', litecoin);

        const dogecoin = new Bitcoin('dogecoin', apiClient);
        this.platformMap.set('dogecoin', dogecoin);

        // NOTE: for  BTC test network
        const tbitcoin = new Bitcoin( 'tbitcoin', apiClient, 'test');
        this.platformMap.set('tbitcoin', tbitcoin);

        this.getPlatformName = this.getPlatformName.bind(this);
    }

    async initCoins(coins) {

        this.coinsMap.clear();
        this.coinsContractsMap.clear();

        for (let coin of coins) {

            let contract = coin.contract || coin.tokenContract || coin.assetName || coin.rri || coin.tokenID || coin.denom;
            let name;
            if (this.coinsMap.has(coin.code)) {
                name = `${coin.code}_${coin.network}`.toUpperCase();
            } else {
                name = coin.code.toUpperCase();
            }

            this.coinsMap.set(name, coin);

            if (contract) {
                coin.contract = contract;
                const id = `${coin.network}_${contract}`.toUpperCase();
                this.coinsContractsMap.set(id, coin);
            }
        }

    }

    async initNodes(nodes, testnets) {
        this.nodesMap.clear();

        const groupNodes = this.groupNodes;
        for (let node of nodes) {
            if (node.testnet && !testnets) continue; // skip testnets if not enabled

            const platform = node.platform;

            const nLocal = {
                ...node,
                name: node.id
            }

            delete nLocal.id;

            if (groupNodes.has(platform)) {
                const nds = groupNodes.get(platform);
                nds.push(nLocal);
            } else {
                const nds = [nLocal];
                groupNodes.set(platform, nds);
            }

            this.nodesMap.set(nLocal.name, nLocal);
        }

        return true;
    }

    async getPlatform(platformName) {
        if (this.platformInit.has(platformName)) {
            return this.platformMap.get(platformName);
        } else {
            console.log(`Init platform: `, platformName);
            const platformObj = this.platformMap.get(platformName);
            await platformObj.setNodes(this.groupNodes.get(platformName));
            this.platformInit.set(platformName, true);
            return platformObj;
        }
    }

    getCoinByName(name) {
        return this.coinsMap.get(name);
    }

    getCoinsById(ids) {
        const coins = [];
        for (let coin of this.coinsMap.values()) {
            if (ids.includes(coin._id)) {
                coins.push(coin);
            }
        }
        return coins;
    }

    getCoreCoins() {
        const nodes = this.getAllNodes();

        const coreCoinsNames = nodes.map(node => node.coin);

        const coins = [];

        for (let coin of this.coinsMap.values()) {
            if (coreCoinsNames.includes(coin.code)) {
                coins.push(coin);
            }
        }

        return coins;
    }

    getCoinByContract(chain, contract) {
        let str = contract ? `${chain}_${contract}` : chain;
        console.log('getCoinByContract: ', str);
        return  this.coinsContractsMap.get(str.toUpperCase());
    }

    getPlatforms() {
        const pfm = [...this.platformMap.keys()];
        return pfm.filter((element) => { return element !== 'tbitcoin' });
    }

    async generateMnemonic(length = 24) {
        if (![12, 24].includes(length)) {
            throw new Error('Wrong mnemonic length (only 12 or 24 words)');
        }
        const platform = await this.getPlatform('ether');
        return platform.generateMnemonic(length);
    }

    async mnemonicToEntropy(mnemonic) {
        const platform = await this.getPlatform('ether');
        return platform.mnemonicToEntropy(mnemonic);
    }

    async validateMnemonic(mnemonic) {
        const platform = await this.getPlatform('ether');
        return platform.validateMnemonic(mnemonic);
    }

    async entropyToMnemonic(entropy) {
        const platform = await this.getPlatform('ether');
        return platform.entropyToMnemonic(entropy);
    }

    entropyToBase64(entropy) {
        return  Buffer.from(entropy).toString('base64');
    }

    entropyFromBase64(b64String) {
        return Buffer.from(b64String, 'base64').toString();
    }

    async mnemonicToSeed(mnemonic) {
        const platform = await this.getPlatform('ether');
        return platform.mnemonicToSeed(mnemonic);
    }

    async checkAndCreateAptosAccount(address, key) {
        const platform = await this.getPlatform('aptos');
        return platform.checkAndCreateAptosAccount(address, key);
    }

    async registerWallet(chain, mnemonic, index) {
        const node = this.nodesMap.get(chain);
        const platform = await this.getPlatform(node.platform);

        let walletObj;

        if (node.platform === 'solana') {
            const seed = await this.mnemonicToSeed(mnemonic);
            walletObj = await platform.registerWallet(seed);
        } else {
            walletObj = await platform.registerWallet(mnemonic, index);
        }

        walletObj.walletAddress = await this.finalizeAddress(node, walletObj.walletAddress);

        return walletObj;
    }

    async finalizeAddress(node, address) {
        if (node.platform.toLowerCase() === 'polka') {
            const chainId = node['chainPrefix'];
            return  this.convertPolkaAddress(address, chainId);
        } else if (node.name === 'xdc') {
            return  address.replace(/^0x/g,'xdc');
        }

        return address;
    }

    async mnemonicToXpub(mnemonic) {
        const platform = await this.getPlatform('ether');
        return platform.mnemonicToXpub(mnemonic);
    }

    async convertPolkaAddress(address, chainId) {
        const platform = await this.getPlatform('polka');
        return platform.convertAddress(address, chainId);
    }

    async addressFromXpub(chain, xpub, index) {
        const platformName = this.getPlatformName(chain);
        if (platformName !== 'ether') {
            throw new Error(`addressFromXpub not supported for ${chain}`);
        }

        const platform = await this.getPlatform(platformName);
        const address = platform.addressFromXpub(xpub, index);

        const node = this.nodesMap.get(chain);

        return this.finalizeAddress(node, address);
    }

    getNode(chain) {
        return  this.nodesMap.get(chain);
    }

    getAllNodes() {
        return [...this.nodesMap.values()];
    }

    getChainById(chainId) {
        for (let node of this.nodesMap.values()) {
            if (node.chain_id === chainId) {
                return node;
            }
        }
    }

    async addressFromKey(chain, key) {
        const platformName = this.getPlatformName(chain);
        const platform = await this.getPlatform(platformName);
        const address =  platform.addressFromKey(key);
        const node = this.nodesMap.get(chain);

        return this.finalizeAddress(node, address);
    }

    getPlatformName(chain) {
        const node = this.nodesMap.get(chain);
        if (node) return node.platform;
    }

    prepareOneTx(node, payload) {
        const srcObj = {
            address: payload.sourceAddress
        };

        const destObj = {
            address: payload.targetAddress
        };

        let coinObj = this.getCoinByName(payload.token);
        if (!coinObj) {
            coinObj = this.getCoinByContract(node.name, payload.token);
        }

        if (!coinObj) throw new Error(`Unknown token : ${payload.token}`);

        const tx = {
            value: payload.amount,
            coin: coinObj,
            node: node.name,
            memo: payload.memo,
        };

        return {
            sourceItem: srcObj,
            destItem: destObj,
            tx: tx,
        };
    }

    async buildTransaction(chain, payload) {
        const node = this.nodesMap.get(chain);
        if (!node) throw new Error(`Unknown chain: ${chain}`);

        if (node.platform === 'solana') {
            if (payload.token !== 'SOL') {
                throw new Error(`Only SOL tokens supported for Solana chain.`);
            }
        }

        const platform = await this.getPlatform(node.platform);

        const txPrepObj = this.prepareOneTx(node, payload);
        const txObj = platform.genTxObj([txPrepObj]);

        return platform.buildTransaction(node, txObj);
    }

    async serializeTransaction(chain, transaction) {
        const node = this.nodesMap.get(chain);
        const platform = await this.getPlatform(node.platform);
        return platform.serializeTransaction(node, transaction);
    }

    async signTransaction(chain, transaction, key) {
        const node = this.nodesMap.get(chain);
        const platform = await this.getPlatform(node.platform);
        return platform.signTransaction(node, transaction, key);
    }

    async checkBalanceAndFee(chain, address, token, value) {
        const node = this.nodesMap.get(chain);

        let coin = this.getCoinByName(token);
        if (!coin) {
            coin = this.getCoinByContract(chain, token);
        }

        if (!coin) return ;

        const feeBalance = await this.getFeeBalance(node, coin, address);

        const resBalance = await this.apiClient.getBalance(chain, address, token);
        const balance = resBalance.balance[0].value;

        // get estimated fee size
        const fee = await this.apiClient.estimateTxFee(chain, feeBalance.feeCoin);

        let result;
        let message = 'OK';
        // sum all up and prepare resulting object
        if (feeBalance.feeCoin === token.toUpperCase()) {
            const sum = value + fee;
            result = balance > sum;
            if (!result) {
                message = `Not enough ${token} on source wallet`;
            }
        } else {
            const isBal = (balance > value);
            const isFee = (feeBalance > fee);
            if (!isBal) {
                message = `Not enough ${token} on source wallet`;
            } else {
                if (!isFee) {
                    message = `Not enough ${feeBalance.feeCoin} on source wallet`;
                }
            }
            result = isBal && isFee;
        }

        return {result, feeCoin: feeBalance.feeCoin, message};
    }

    async getFeeBalance(node, coin, address) {
        let feeCoinName = node.coin;

        if (feeCoinName !== coin.code) {
            const balance = await this.apiClient.getBalance(node.name, address, feeCoinName);
            return { balance: balance.balance[0].value, feeCoin: feeCoinName };
        } else {
            return { balance: 0, feeCoin: coin.code };
        }
    }

    async signExtTransaction(params, key) {
        const node = this.nodesMap.get(params.nodeName);
        if (!['ether', 'solana', 'polka', 'tron'].includes(node.platform)) return;

        const platform = await this.getPlatform(node.platform);
        return platform ? platform.signExtTransaction(params, key, node) : 0;
    }

    async sendExtTransaction(params, key) {
        const node = this.nodesMap.get(params.nodeName);
        if (node.platform !== 'ether') return;

        const platform = await this.getPlatform(node.platform);
        return platform ? platform.sendExtTransaction(params, key, node) : 0;
    }

    async signExtMessage(params, key) {
        const node = this.nodesMap.get(params.nodeName);
        if (!['ether', 'solana', 'polka', 'tron'].includes(node.platform)) return;

        console.log(node);

        const platform = await this.getPlatform(node.platform);
        return platform ? platform.signExtMessage(params, key, node) : 0;
    }

    async signExtTypedData(params, key) {
        const node = this.nodesMap.get(params.nodeName);
        if (node.platform !== 'ether') return;

        const platform = await this.getPlatform(node.platform);
        return platform ? platform.signExtTypedData(params, key) : 0;
    }

    async isAddressValid(address, chain) {
        if (chain) {
            return {result: await this.checkAddress(chain, address), platform: chainsPlatforms.get(chain)};
        }

        for (let chain of validChains) {
            const res = WAValidator.validate(address, chain);
            if (res) {
                return {result: res, platform: chainsPlatforms.get(chain)};
            }
        }

        // xinfin
        let res1 = await this.checkAddress('CLO', address);
        if (res1) {
            return {result: res1, platform: chainsPlatforms.get('eth')};
        }

        // bnb, radix, terra, aptos, polka
        for (let chain of supChains) {
            const res = await this.checkAddress(chain, address);
            if (res) {
                return {result: res, platform: chainsPlatforms.get(chain.toLowerCase())};
            }
        }

        return {result: false, platform: 'unknown'};
    }

    async checkAddress(coinName, address) {
        let coin;

        if (typeof coinName === 'string') {
            coin = await this.getCoinByName(coinName.toUpperCase());
        } else {
            if (coinName.network) {
                coin = coinName;
            } else {
                coin = await this.getCoinByName(coinName.name);
            }

        }
        if (!coin) return true;

        let baseName = coin.network.toUpperCase();

        if (['BSC','BTTC'].includes(baseName)) baseName = 'ETH';

        if (coin) {
            const node = this.nodesMap.get(coin.network);
            if (!node) return false;

            let token = baseName === 'TBTC' ? 'BTC' : baseName;
            if (node.coin) {
                token = node.coin;
            }
            if (token === 'TRX_SHA') {
                token = 'TRX';
            }
            if (token === 'TSOL') {
                token = 'SOL';
            }

            if (['BTC', 'LTC', 'TRX', 'SOL'].includes(token)) {
                return WAValidator.validate(address, token);
            }

            const platform = await this.getPlatform(node.platform);
            return platform.checkAddress(address);
        } else {

            return WAValidator.validate(address, baseName);
        }
    }
}

module.exports = {
    Blockchain,
    coinFormat
};
