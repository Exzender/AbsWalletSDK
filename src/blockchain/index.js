/**
 * Module with Blockchain functions
 */
const { Binance, EtherPlatform, AptosPlatform, Bitcoin, PolkaPlatform,
    RadixPlatform, SolanaPlatform, TerraPlatform, TronPlatform } = require('./../platforms');
const { coinFormat } = require('./utils');

class Blockchain  {
    constructor(apiClient, testNodes = false) {
        this.platformMap = new Map();
        this.nodesMap = new Map();
        this.coinsMap = new Map();
        this.coinsContractsMap = new Map();
        this.apiClient = apiClient;

        /** Binance (BNB, TWT) **/
        const binance = new Binance(apiClient);
        this.platformMap.set('binance', binance);

        /** Ethereum (ETH, ETC, CLO) **/
        const ether = new EtherPlatform(apiClient, testNodes);
        this.platformMap.set('ether', ether);

        /** Tron (TRX) **/
        const tron = new TronPlatform();
        this.platformMap.set('tron', tron);

        /** Solana (SOL) **/
        const sol = new SolanaPlatform();
        this.platformMap.set('solana', sol);

        /** Radix (XRD) **/
        const rdx = new RadixPlatform();
        this.platformMap.set('radix', rdx);

        /** Terra (classic, 2.0) **/
        const terra = new TerraPlatform();
        this.platformMap.set('terra', terra);

        /** PolkaDot **/
        const polka = new PolkaPlatform();
        this.platformMap.set('polka', polka);

        /** Aptos **/
        const aptos = new AptosPlatform();
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
    }

    async initCoins(coins) {

        this.coinsMap.clear();
        this.coinsContractsMap.clear();

        for (let coin of coins) {

            let contract = coin.tokenContract || coin.assetName || coin.rri || coin.tokenID || coin.denom;
            let name;
            if (this.coinsMap.has(coin.code)) {
                name = `${coin.code}_${coin.node}`.toUpperCase();
            } else {
                name = coin.code.toUpperCase();
            }

            this.coinsMap.set(name, coin);

            if (contract) {
                coin.contract = contract;
                this.coinsContractsMap.set(contract, name);
            }
        }

    }

    async initNodes(nodes) {
        this.nodesMap.clear();

        const groupNodes = new Map();
        for (let node of nodes) {
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

        const platforms = this.getPlatforms();
        const promises = [];
        for (let platformName of platforms) {
            const platformObj = this.platformMap.get(platformName);
            promises.push(platformObj.setNodes(groupNodes.get(platformName)));
        }

        await Promise.all(promises);

        return true;
    }

    getCoinByName(name) {
        return this.coinsMap.get(name);
    }

    getCoinByContract(contract) {
        const name =  this.coinsContractsMap.get(contract);
        return this.getCoinByName(name);
    }

    getPlatforms() {
        const pfm = [...this.platformMap.keys()];
        return pfm.filter((element) => { return element !== 'tbitcoin' });
    }

    generateMnemonic(length = 24) {
        if (![12, 24].includes(length)) {
            throw new Error('Wrong mnemonic length (only 12 or 24 words)');
        }
        const platform = this.platformMap.get('ether');
        return platform.generateMnemonic(length);
    }

    mnemonicToEntropy(mnemonic) {
        const platform = this.platformMap.get('ether');
        return platform.mnemonicToEntropy(mnemonic);
    }

    validateMnemonic(mnemonic) {
        const platform = this.platformMap.get('ether');
        return platform.validateMnemonic(mnemonic);
    }

    entropyToMnemonic(entropy) {
        const platform = this.platformMap.get('ether');
        return platform.entropyToMnemonic(entropy);
    }

    entropyToBase64(entropy) {
        return  Buffer.from(entropy).toString('base64');
    }

    entropyFromBase64(b64String) {
        return Buffer.from(b64String, 'base64').toString();
    }

    async mnemonicToSeed(mnemonic) {
        const platform = this.platformMap.get('ether');
        return platform.mnemonicToSeed(mnemonic);
    }

    async registerWallet(chain, mnemonic, index) {
        const node = this.nodesMap.get(chain);
        const platform = this.platformMap.get(node.platform);

        let walletObj;

        if (node.platform === 'solana') {
            const seed = await this.mnemonicToSeed(mnemonic);
            walletObj = await platform.registerWallet(seed);
        } else {
            walletObj = await platform.registerWallet(mnemonic, index);
        }

        walletObj.walletAddress = this.finalizeAddress(node, walletObj.walletAddress);

        return walletObj;
    }

    finalizeAddress(node, address) {
        if (node.platform.toLowerCase() === 'polka') {
            const chainId = node['chainPrefix'];
            return  this.convertPolkaAddress(address, chainId);
        } else if (node.name === 'xdc') {
            return  address.replace(/^0x/g,'xdc');
        }

        return address;
    }

    async mnemonicToXpub(mnemonic) {
        const platform = this.platformMap.get('ether');
        return platform.mnemonicToXpub(mnemonic);
    }

    convertPolkaAddress(address, chainId) {
        const platform = this.platformMap.get('polka');
        return platform.convertAddress(address, chainId);
    }

    async addressFromXpub(chain, xpub, index) {
        const platformName = this.getPlatformName(chain);
        if (platformName !== 'ether') {
            throw new Error(`addressFromXpub not supported for ${chain}`);
        }

        const platform = this.platformMap.get(platformName);
        const address = platform.addressFromXpub(xpub, index);

        const node = this.nodesMap.get(chain);

        return this.finalizeAddress(node, address);
    }

    addressFromKey(chain, key) {
        const platformName = this.getPlatformName(chain);
        const platform = this.platformMap.get(platformName);
        const address =  platform.addressFromKey(key);
        const node = this.nodesMap.get(chain);

        return this.finalizeAddress(node, address);
    }

    getPlatformName(chain) {
        const node = this.nodesMap.get(chain);
        return node.platform;
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
            coinObj = this.getCoinByContract(payload.token);
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

        if (!['ether','bitcoin','dogecoin','litecoin', 'radix'].includes(node.platform)) {
            throw new Error(`Local tx build fro ${chain} unsupported yet.`);
        }

        const platform = this.platformMap.get(node.platform);

        const txPrepObj = this.prepareOneTx(node, payload);

        // TODO check target account or address (some chains requires accounts to be initialized)
        // call API-function

        // TODO check source balance (fee + amount)

        const txObj = platform.genTxObj([txPrepObj]);
        // console.log(txObj);

        return platform.buildTransaction(node, txObj);
    }

    serializeTransaction(chain, transaction) {
        const node = this.nodesMap.get(chain);
        const platform = this.platformMap.get(node.platform);
        return platform.serializeTransaction(node, transaction);
    }

    async signTransaction(chain, transaction, key) {
        const node = this.nodesMap.get(chain);
        const platform = this.platformMap.get(node.platform);
        return platform.signTransaction(node, transaction, key);
    }
}

module.exports = {
    Blockchain,
    coinFormat
};
