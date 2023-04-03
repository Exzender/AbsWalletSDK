const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

const PASSWORD_LENGTH = 18;
const LOWERCASE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz'; // 26 chars
const UPPERCASE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 26 chars
const NUMBERS = '0123456789'; // 10 chars
const SYMBOLS = ',./<>?;\'":[]\\|}{=-_+`~!@#$%^&*()'; // 32 chars
const ALPHANUMERIC_CHARS = LOWERCASE_ALPHABET + UPPERCASE_ALPHABET + NUMBERS; // 62 chars
const ALL_CHARS = ALPHANUMERIC_CHARS + SYMBOLS; // 94 chars

function randomOid() {
    const timestamp = Math.round(new Date().getTime() / 1000).toString(16);
    const randomHexString = Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join("");

    return `${timestamp}${randomHexString}`;
}


function generateRandomPassword(length = PASSWORD_LENGTH, alphabet = ALPHANUMERIC_CHARS) {
    const rb = crypto.randomBytes(length);
    let rp = '';

    for (let i = 0; i < length; i++) {
        rb[i] = rb[i] % alphabet.length;
        rp += alphabet[rb[i]];
    }

    return rp;
}

function getIv(password) {
    return Buffer.from(crypto.createHash('sha256').update(String(password)).digest('hex').substring(0, 32), 'hex');
}

function getKey(password) {
    return crypto.createHash('sha256').update(String(password)).digest('base64').substring(0, 32);
}

async function encryptAsync(data, password) {
    const key = getKey(password);
    const iv = getIv(password);
    // console.log('key: ', key);

    return new Promise((resolve, reject) => {
        try {
            const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
            let encrypted = cipher.update(data);
            // console.log('encrypted:', encrypted.toString());
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            // console.log('encrypted:', encrypted.toString());
            resolve(encrypted.toString('hex'));
        } catch (exception) {
            reject(exception);
        }
    });
}

async function decryptAsync(data, password) {

    // console.log('decryptAsync', data, password);

    const key = getKey(password);
    const iv = getIv(password);
    const encryptedText = Buffer.from(data, 'hex');

    return new Promise((resolve, reject) => {
        try {
            const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
            let decrypted = decipher.update(encryptedText);
            // console.log('decrypted:', decrypted.toString());
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            // console.log('decrypted:', decrypted.toString());
            resolve(decrypted.toString());
        } catch (exception) {
            reject(exception);
        }
    });
}

module.exports = {
    encryptAsync,
    decryptAsync,
    generateRandomPassword,
    randomOid
}
