const fs = require('fs');
const path = require('path');
const { AES, enc } = require('crypto-js');
const { v4: uuid } = require('uuid');

const PASS = process.env.UNLOCK_PASS;

function isPathExists (filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

function getWalletsPath(filePath) {
    return filePath || path.resolve(__dirname, './.abwsdk/wallets.dat');
}

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

async function getWallet (id, pass, filePath) {
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

function getPrivateKey (id, pass, filePath) {
    let wallets;
    try {
        wallets = getWalletsFromFile(pass, filePath);
    } catch (e) {
        return null;
    }

    if (!wallets[id]) {
        console.error(`No such wallet for signatureId '${id}'.`);
        return null;
    }

    return wallets[id].key;
}

function getAddress (id, pass, filePath) {
    let wallets;
    try {
        wallets = getWalletsFromFile(pass, filePath);
    } catch (e) {
        return null;
    }

    if (!wallets[id]) {
        console.error(`No such wallet for signatureId '${id}'.`);
        return null;
    }

    return wallets[id].address;
}

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

async function storeWallet (wallet, chain, pass, filePath) {
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