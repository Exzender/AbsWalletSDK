const fs = require('fs');
const { AES, enc } = require('crypto-js');
const { v4: uuid } = require('uuid');
const { isPathExists } = require('./../utils');
const homedir = require('os').homedir();

const PASS = process.env.UNLOCK_PASS;

function getWalletsPath(filePath) {
    return filePath || `${homedir}/.abwsdk/wallets.dat`;
}

/**
 * Reads local wallets file and decodes it using provided pass
 * @param {string} [pass] password
 * @param {string} [filePath] path to local wallets file
 * @returns {Object} decoded wallets
 */
function getWalletsFromFile (pass, filePath) {
    const password = pass || PASS;
    const walletPath = getWalletsPath(filePath);

    if (!fs.existsSync(walletPath)) {
        throw new Error('File not found');
    }

    const data = fs.readFileSync(walletPath, { encoding: 'utf8' });
    if (!data) {
        throw new Error('No wallets found');
    }

    return  JSON.parse(AES.decrypt(data, password).toString(enc.Utf8));
}

function writeWalletsToFile (wallets, pass, filePath) {
    const password = pass || PASS;
    const fullPath = getWalletsPath(filePath);
    isPathExists(fullPath);
    fs.writeFileSync(fullPath, AES.encrypt(JSON.stringify(wallets), password).toString());
}

function isWalletsValid (id, wallets, chain) {
    if (Object.keys(wallets).length === 0) {
        console.error(`No such wallet for chain '${chain}'.`);
        return false;
    }
    if (id && !wallets[id]) {
        console.error(`No such wallet for signatureId '${id}'.`);
        return false;
    }

    return true;
}

/**
 * Retrieves one wallet from local storage by wallet ID
 * @param {string} id wallet ID
 * @param {string} [pass] password
 * @param {string} [filePath] path to local wallets file
 * @returns {Object} decoded wallet
 */
function getWallet (id, pass, filePath) {
    try {
        const data = getWalletsFromFile(pass, filePath);

        if (!data && !isWalletsValid(data, undefined, id )) {
            return;
        }

        return data[id];

    } catch (e) {
        console.error(e.toString());
        throw new Error(`Wrong password.`);
    }
}

/**
 * Retrieves wallets from local storage by mnemonic
 * @param {string} mnemonic mnemonic phrase
 * @param {string} [pass] password
 * @param {string} [chain] chain - if needed to filter wallets by specific chain
 * @param {string} [filePath] path to local wallets file
 * @returns {array<Object>} array of decoded wallets
 */
function getWalletByMnemonic (mnemonic, pass, chain, filePath)  {
    let wallets;
    try {
        wallets = getWalletsFromFile(pass, filePath);
    } catch (e) {
        return [];
    }

    return Object.keys(wallets)
        .filter(id => {
            let res = true;
            if (chain) {
                res = wallets[id].chain === chain;
            }
            res = res && (wallets[id].mnemonic === mnemonic);
            return res;
        })
        .reduce((wals, id) => ({ ...wals, [id]: wallets[id] }), {});
}

/**
 * Retrieves wallets from local storage by specific chain
 * @param {string} chain filter wallets by specific chain
 * @param {string} [pass] password
 * @param {string} [filePath] path to local wallets file
 * @returns {array<string>} array of wallet ID's
 */
function getWalletsByChain (chain, pass, filePath) {
    let wallets;
    try {
        wallets = getWalletsFromFile(pass, filePath);
    } catch (e) {
        return [];
    }

    const keys = []
    for (const id in wallets) {
        if (chain === wallets[id].chain) {
            keys.push(id);
        }
    }

    return keys;
}

/**
 * Retrieves private key of the wallet by ID
 * @param {string} id wallet ID
 * @param {string} [pass] password
 * @param {string} [filePath] path to local wallets file
 * @returns {string} private key
 */
function getPrivateKey (id, pass, filePath) {
    let wallets;
    try {
        wallets = getWalletsFromFile(pass, filePath);
    } catch (e) {
        return undefined;
    }

    if (!wallets[id]) {
        console.error(`No such wallet for signatureId '${id}'.`);
        return undefined;
    }

    return wallets[id].key;
}

/**
 * Retrieves address of the wallet by ID
 * @param {string} id wallet ID
 * @param {string} [pass] password
 * @param {string} [filePath] path to local wallets file
 * @returns {string} address
 */
function getAddress (id, pass, filePath) {
    let wallets;
    try {
        wallets = getWalletsFromFile(pass, filePath);
    } catch (e) {
        return undefined;
    }

    if (!wallets[id]) {
        console.error(`No such wallet for signatureId '${id}'.`);
        return undefined;
    }

    return wallets[id].address;
}

/**
 * Deletes wallet by ID from local storage
 * @param {string} id wallet ID
 * @param {string} [pass] password
 * @param {string} [filePath] path to local wallets file
 * @returns {undefined}
 */
function removeWallet (id, pass, filePath) {
    let wallets;
    try {
        wallets = getWalletsFromFile(pass, filePath);
    } catch (e) {
        return;
    }

    delete wallets[id];

    writeWalletsToFile(wallets, pass, filePath);
}

/**
 * Stores AES encoded wallet to local storage
 * @param {object} wallet wallet created with generateWallet
 * @param {string} chain blockchain name
 * @param {string} [pass] password
 * @param {string} [filePath] path to local wallets file
 * @returns {Object} wallet object with ID and without a key and mnemonic
 */
function storeWallet (wallet, chain, pass, filePath) {
    const walletPath = getWalletsPath(filePath);

    const key = uuid();

    const wallets = { [key]: { ...wallet, chain } };

    if (!fs.existsSync(walletPath)) {
        writeWalletsToFile(wallets, pass, filePath);
    } else {
        const data = getWalletsFromFile(pass, filePath);
        let walletsData = wallets;
        if (data) {
            walletsData = { ...walletsData, ...data };
        }
        writeWalletsToFile(walletsData, pass, filePath);
    }

    const value = { id: key, chain: chain };

    if (wallet.address) {
        value.address = wallet.address;
    }
    if (wallet.xpub) {
        value.xpub = wallet.xpub;
    }

    return { ...value };
}

/**
 * Reads and decodes all wallets from local file and returns them as Stringified JSON
 * @param {string} [pass] password
 * @param {string} [filePath] path to local wallets file
 * @returns {string} stringified JSON
 */
function exportWallets (pass, filePath) {
    try {
        const wallets = getWalletsFromFile(pass, filePath);
        return JSON.stringify(wallets, null, 2);
    } catch (e) {
        throw new Error(e);
    }
}

module.exports = {
    getWalletsFromFile,
    exportWallets,
    getWallet,
    getWalletByMnemonic,
    getWalletsByChain,
    getPrivateKey,
    getAddress,
    removeWallet,
    storeWallet
}