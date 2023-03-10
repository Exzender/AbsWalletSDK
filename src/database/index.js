'use strict';
const MongoClient = require('mongodb').MongoClient;

const { encryptAsync, decryptAsync, generateRandomPassword } = require('./../utils');
const { coreChains } = require('./../const');

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
            this.walletConnect = clDb.collection('wallet_connect');

            const pkDb = clientPk.db(pkName);
            this.mnemoTable = pkDb.collection('mnemonic');
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
    async getWalletConnects() {
        return this.walletConnect.find({}).toArray();
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
        let activeChains = user ? user['active_chains'] ? user['active_chains'] : [] : [];
        let hiddenChains = user ? user['hidden_chains'] ? user['hidden_chains'] : [] : [];

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
}

module.exports = new AbwDatabase();