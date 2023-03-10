const { generateRandomPassword, encryptAsync, decryptAsync, encryptMnemonic, reverseMap } = require('./../utils');
const { oneHourMs, oneDayMs, networks, caipMap, coreChains } = require('./../const');
const Web3 = require('web3');

function coinFormatInt(aValue, aPos) {
    const val = parseFloat(aValue);
    // console.log(val);
    let nPos = aPos;
    const absVal = Math.abs(val);
    if  (absVal < 0.0000000001) {
        // console.log('val < 0.0000000001');
        nPos = 13;
    } else if  (absVal < 0.000000001) {
        // console.log('val < 0.000000001');
        nPos = 12;
    } else if  (absVal < 0.00000001) {
        // console.log('val < 0.00000001');
        nPos = 11;
    } else if  (absVal < 0.0000001) {
        // console.log('val < 0.0000001');
        nPos = 10;
    } else if  (absVal < 0.000001) {
        // console.log('val < 0.000001');
        nPos = 9;
    } else if (absVal < 0.00001) {
        // console.log('val < 0.00001');
        nPos = 8;
    } else  if (absVal < 0.0001) {
        // console.log('val < 0.0001');
        nPos = 7;
    } else  if (absVal < 0.001) {
        // console.log('val < 0.0001');
        nPos = 6;
    } else  if (absVal < 0.01) {
        // console.log('val < 0.0001');
        nPos = 5;
    }
    if (aPos > nPos) nPos = aPos;
    // console.log(val, aPos, nPos);
    const pow = Math.pow(10, nPos);
    const res = Math.floor(val * pow) / pow;
    return {num: res, str: res.toFixed(nPos)};
}

function convertHexToUtf8(value) {
    if (Web3.utils.isHex(value)) {
        return  Web3.utils.hexToUtf8(value);
    }

    return value;
}

function coinFormatStr(aValue, aPos) {
    const num = coinFormatInt(aValue, aPos);
    return num.str;
}

function numberWithCommas(x) {
    const parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}

function coinFormat(aValue, aPos) {
    const num = coinFormatInt(aValue, aPos);
    return num.num;
}

function isPromise(promise) {
    return !!promise && typeof promise.then === 'function'
}

// function roundPlaces (num, places) {
//     if (!("" + num).includes("e")) {
//         return +(Math.round(num + "e+" + places) + "e-" + places);
//     } else {
//         let arr = ("" + num).split("e");
//         let sig = ""
//         if (+arr[1] + places > 0) {
//             sig = "+";
//         }
//
//         return +(Math.round(+arr[0] + "e" + sig + (+arr[1] + places)) + "e-" + places);
//     }
// }

function formatNumber(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ')
}

function getWalletAddress(blockchain, user, node) {
    let retAddress;

    const platform = node.platform;
    if (platform.toLowerCase() === 'polka') {
        const chainId = node.chainPrefix;
        const address = user[`${platform}_wallet_address`];
        if (address) {
            retAddress = blockchain.convertPolkaAddress(address, chainId);
        }
    } else {
        retAddress = user[`${platform}_wallet_address`];
    }

    return retAddress;
}

module.exports = {
    coinFormat,
    coinFormatStr,
    formatNumber,
    isPromise,
    getWalletAddress,
    numberWithCommas,
    convertHexToUtf8
};
