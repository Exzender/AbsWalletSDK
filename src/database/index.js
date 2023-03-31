'use strict';
const MongoClient = require('mongodb').MongoClient;

const { encryptAsync, decryptAsync, generateRandomPassword, randomOid } = require('./../utils');
const { coreChains } = require('./../const');
const {ObjectId} = require("mongodb");

const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const pkUri = process.env.MONGOPK_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_NAME || 'abwsdkdb';
const pkName = process.env.MONGOPK_NAME || 'abwpkdb';

class AbwDatabase {
    constructor() {

        let options = {
            useUnifiedTopology: true
        };

        this.mongoClient = new MongoClient(dbUri, options);
        this.mongoPkClient = new MongoClient(pkUri, options);

        this.init = this.init.bind(this);
    }

    /**
     * Connect to mongo DB server(s)
     * @param {object} blockchain blockchain object got from call to abwSDK.initBlockchain()
     */
    async init(blockchain) {

        if (this.usersTable) return;

        this.blockchain = blockchain;

        const db = this.mongoClient.connect();
        const pk = this.mongoPkClient.connect();

        try {

            const [ clientDb, clientPk ] = await Promise.all([db, pk]);

            const clDb = clientDb.db(dbName);
            this.usersTable = clDb.collection('users');
            this.usersArchiveTable = clDb.collection('users_archive');
            this.walletConnect = clDb.collection('wallet_connect');

            const pkDb = clientPk.db(pkName);
            this.mnemoTable = pkDb.collection('mnemonic');
            this.mnemoArchiveTable = pkDb.collection('mnemonic_archive');
            // this.keysTable = pkDb.collection('keys');

        } catch (e) {
            console.error(`Error connecting to DB: ${e.toString()}`);
        }
    }

    /**
     * Stores/updates encrypted keys & mnemonic
     * @param {string|number} user_id user ID
     * @param {object} object JSON object holding mnemonic & keys
     * @param {number} [index=0] for later use to provide multi-wallets per user
     * @returns {Promise<object>} result of mongo DB operation
     */
    async updateKeys(user_id, object, index = 0) {
        return this.mnemoTable.updateOne({user_id: user_id, index: index},{$set: object}, { upsert: true })
            .catch((e) => console.error(`mongo error: ${e.stack}`));
    }

    /**
     * Stores/updates user into DB.
     * Private keys encrypted on the fly and stored to another DB
     * user_id property is mandatory and must be unique
     * @param {object} user JSON object with user params
     * @returns {Promise<object>} result of mongo DB operation
     */
    async storeUser(user) {

        if (!user.user_id) {
            throw new Error('User object must have "user_id" property');
        }

        let parsedUser;
        if (user.wallet) {

            parsedUser = {
                ...user
            }

            delete parsedUser.wallet;

            let parsedWallet = {
                ...user.wallet
            }

            if (!parsedUser.pass_hash) {
                parsedUser.pass_hash = generateRandomPassword();
            }

            let updateKeysObject = {};

            for (let prop of Object.keys(user.wallet)) {
                if (prop.toLowerCase() === 'mnemonic') {
                    updateKeysObject.mnemonic = await encryptAsync(parsedWallet[prop], parsedUser.pass_hash);
                    delete parsedWallet[prop];
                } else {
                    if (parsedWallet[prop].key) {
                        updateKeysObject[prop] = await encryptAsync(parsedWallet[prop].key, parsedUser.pass_hash);
                        delete parsedWallet[prop].key;
                    }
                }
            }

            if (Object.keys.length) {
                await this.updateKeys(parsedUser.user_id, updateKeysObject);
            }

            parsedUser.wallet = parsedWallet;

        } else {
            parsedUser = {
                ...user
            }
        }


        return this.usersTable.updateOne({ user_id: parsedUser.user_id }, { $set: parsedUser }, { upsert: true });
    }

    /**
     * Get user from DB by (user_id)
     * Returned object does not have mnemonic of private keys
     * @param {string|number} user_id unique user ID (user_id)
     * @returns {Promise<object>} JSON object if found
     */
    async getUser(user_id) {
        return this.usersTable.findOne({ user_id: user_id });
    }

    /**
     * Archive USER and it's wallets by (user_id)
     * Returned object does not have mnemonic of private keys
     * @param {string|number} user_id unique user ID (user_id)
     * @returns {Promise<undefined>}
     */
    async archiveUser(user_id) {
        let user, mnemos;
        try {
            user = await this.usersTable.findOne({user_id: user_id});
            if (!user) return;

            mnemos = await this.mnemoTable.find({user_id: user_id}).toArray();
            if (!mnemos) return;
        } catch (e) {
            throw new Error(e);
        }

        // generate unique index
        const rId = randomOid();
        const archId = new ObjectId(rId);

        // archive
        try {
            let archUser = {
                ...user,
                arch_id: archId
            };
            delete archUser._id;
            await this.usersArchiveTable.insertOne(archUser);

            for (let mnemo of mnemos) {
                let archMnemo = {
                    ...mnemo,
                    arch_id: archId
                };
                delete archMnemo._id;
                await this.mnemoArchiveTable.insertOne(archMnemo);
            }

        } catch (e) {
            // revert changes
            this.usersArchiveTable.deleteMany({arch_id: archId}).then();
            this.mnemoArchiveTable.deleteMany({arch_id: archId}).then();
            throw new Error(e);
        }

        // delete
        try {
            await this.usersTable.deleteOne({user_id: user_id});
            await this.mnemoTable.deleteMany({user_id: user_id});
        } catch (e) {
            throw new Error(e);
        }

    }

    /**
     * Get array of users from DB by any property
     * @param {object} query JSON object with search properties
     * @returns {Promise<array<object>>} array of JSON objects if found
     */
    async getUsers(query) {
        return this.usersTable.find(query).toArray();
    }

    /**
     * Get decoded user's mnemonic phrase by user's ID
     * @param {string|number} user_id unique user ID (user_id)
     * @param {number} [index=0] for later use to provide multi-wallets per user
     * @returns {Promise<string>} mnemonic phrase
     */
    async getWalletMnemonic(user_id, index = 0) {
        const userKeys = await this.mnemoTable.findOne({ user_id: user_id, index: index });

        if (userKeys) {
            try {
                const user = await this.getUser(user_id);
                return decryptAsync(userKeys['mnemonic'], user.pass_hash);
            } catch (e) {
                throw new Error('Error getting user key');
            }
        }
    }

    /**
     * Get decoded user's key by user's ID and chain name
     * @param {string|number} user_id unique user ID (user_id)
     * @param {string} chain chain name
     * @param {number} [index=0] for later use to provide multi-wallets per user
     * @returns {Promise<string>} private key
     */
    async getWalletKey(user_id, chain, index = 0) {
        const platform = this.blockchain.getPlatformName(chain);

        const userKeys = await this.mnemoTable.findOne({ user_id: user_id, index: index });

        if (userKeys) {
            try {
                const user = await this.getUser(user_id);
                return decryptAsync(userKeys[platform], user.pass_hash);
            } catch (e) {
                throw new Error('Error getting user key');
            }
        }
    }

    /**
     * Get user's wallet address by user's ID and chain name.
     * Addresses for chains with same platform - are equal.
     * But it some cases they need to be converted (for example: polka based chains).
     * @param {object} user JSON object - user
     * @param {string} chain chain name
     * @returns {Promise<string>} address
     */
    async getWalletAddress(user, chain) {

        const platform = this.blockchain.getPlatformName(chain);
        const node = this.blockchain.getNode(chain);

        return this.blockchain.finalizeAddress(node, user.wallet[platform].address);
    }

    /** WalletConnect */

    /**
     * Get active walletconnect sessions for User
     * @param {string|number} [userId] user ID - if no user ID, all active session returned
     * @returns {Promise<array<object>>} JSON object with session params
     */
    async getWalletConnects(userId) {
        const filter = userId ? {user_id: userId} : {};
        return this.walletConnect.find(filter).toArray();
    };

    async getWalletConnect (filter) {
        return this.walletConnect.findOne(filter);
    };

    async calcWalletConnect (userId) {
        return this.walletConnect.countDocuments({user_id: userId});
    };

    async deleteWalletConnect (peerId) {
        return this.walletConnect.deleteOne({peer_id: peerId}).catch((e) => {
            console.error(`mongo error: ${e}`);
        });
    };

    async insertWalletConnect (connection) {
        return this.walletConnect.updateOne({ peer_id: connection.peer_id }, {$set: connection}, { upsert: true })
            .catch((e) => {
                console.error(`mongo error: ${e}`);
            });
    };

    /** Customize active (enabled) chains/tokens */

    /**
     * Get user's preferences: enabled blockchains
     * @param {object} user JSON object - user
     * @returns {array<string>} array of enabled chains (names | ids)
     */
    getUserChains(user) {
        let chains = user['active_chains'] || [];
        return coreChains.concat(chains);
    }

    /**
     * Set user's preferences: enable or disable blockchains
     * @param {object} user JSON object - user
     * @param {array<string>} list pass empty array ([]) to enable/disable all chains at once
     * @param {boolean} enable true - to enable chains listed in list
     * @returns {Promise<array<string>>} array of enabled chains (names | ids)
     */
    async switchEnabledChains(user, list, enable) {
        let activeChains = user['active_chains'] || [];
        let hiddenChains = user['hidden_chains'] || [];

        const chainsMap = new Set(activeChains);
        const hiddenMap = new Set(hiddenChains);

        if (list.length === 0) { // mark all chains
            const chains = this.blockchain.getAllNodes();

            if (enable) {
                for (let chain of chains) {
                    if (!coreChains.includes(chain['name'])) {
                        chainsMap.add(chain['name']);
                    }
                }
                hiddenMap.clear();
            } else {
                for (let chain of chains) {
                    if (!coreChains.includes(chain['name'])) {
                        hiddenMap.add(chain['name']);
                    }
                }
                chainsMap.clear();
            }
        } else {
            if (enable) {
                for (let chain of list) {
                    if (!coreChains.includes(chain)) {
                        chainsMap.add(chain);
                        hiddenMap.delete(chain);
                    }
                }
            } else {
                for (let chain of list) {
                    if (!coreChains.includes(chain)) {
                        chainsMap.delete(chain);
                        hiddenMap.add(chain);
                    }
                }
            }
        }

        user['active_chains'] = Array.from(chainsMap);
        user['hidden_chains'] = Array.from(hiddenMap);

        await this.storeUser(user);

        return this.getUserChains(user);
    }

    /**
     * Get user's preferences: enabled tokens
     * @param {object} user JSON object - user
     * @returns {array<object>} array of enabled tokens (JSON objects)
     */
    async getUserCoins (user) {
        const keys = [];

        const hidden = user.hidden_tokens || [];
        const set = new Set(hidden);
        if (user.active_tokens) {
            for (let tokenId of user.active_tokens) {
                if (!set.has(tokenId)) {
                    keys.push(tokenId);
                }
            }
        }

        try {
            return this.blockchain.getCoreCoins().concat(this.blockchain.getCoinsById(keys));
        } catch (e) {
            return [];
        }
    };

    /**
     * Set user's preferences: enable or disable tokens
     * @param {object} user JSON object - user
     * @param {array<string>} list list of tokens names or contracts
     * @param {boolean} enable true - to enable chains listed in list
     * @returns {Promise<array<object>>} array of enabled tokens (objects)
     */
    async switchEnabledTokens(user, list, enable) {
        let activeTokensArray = user['active_tokens'] || [];
        let hiddenTokensArray = user['hidden_tokens'] || [];

        const activeTokens = new Set(activeTokensArray);
        const hiddenTokens = new Set(hiddenTokensArray);

        const coreCoins = this.blockchain.getCoreCoins();

        const coreTokens = coreCoins.map(coin => coin.name);

        if (enable) {
            for (let token of list) {
                if (!coreTokens.includes(token)) {
                    let coin = this.blockchain.getCoinByName(token);
                    if (!coin) {
                        coin = this.blockchain.getCoinByContract(token);
                    }
                    if (coin) {
                        activeTokens.add(coin._id);
                        hiddenTokens.delete(coin._id);
                    }
                }
            }
        } else {
            for (let token of list) {
                if (!coreTokens.includes(token)) {
                    const coin = this.blockchain.getCoinByName(token);
                    if (coin) {
                        activeTokens.delete(coin._id);
                        hiddenTokens.add(coin._id);
                    }
                }
            }
        }

        user['active_tokens'] = Array.from(activeTokens);
        user['hidden_tokens'] = Array.from(hiddenTokens);

        await this.storeUser(user);

        return this.getUserCoins(user);
    }

    /**
     * Set user's preferences: automatically enable tokens, found in user's wallet
     * @param {string} chain chain where wallet balances were found
     * @param {object} user JSON object - user
     * @param {array<object>} balances balance property returned by getTokensOnWallet
     * @returns {Promise<array<object>>} array of enabled tokens (objects)
     */
    async saveTokensFromBalance(chain, user, balances){
        // map token to _id
        const filtered = tokens.map(balance => {
            const token = balance.token ? balance.token : balance;
            if (token.contract !== '0') {
                return `${chain}_${token.contract}`;
            }
            return `${token.name}`;
        });

        return this.switchEnabledTokens(user, filtered, true);
    }
}

module.exports = new AbwDatabase();