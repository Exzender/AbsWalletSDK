const { encryptAsync, decryptAsync, generateRandomPassword, randomOid } = require('./cipher');
const file = require('./file');

function reverseMap(map) {
    return new Map(Array.from(map, a => a.reverse()));
}

module.exports = {
    ...file,
    reverseMap,
    encryptAsync,
    decryptAsync,
    generateRandomPassword,
    randomOid
};
