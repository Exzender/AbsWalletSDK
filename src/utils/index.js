const { encryptAsync, decryptAsync, generateRandomPassword } = require('./cipher');

function reverseMap(map) {
    return new Map(Array.from(map, a => a.reverse()));
}

module.exports = {
    reverseMap,
    encryptAsync,
    decryptAsync,
    generateRandomPassword
};
