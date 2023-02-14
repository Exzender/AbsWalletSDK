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

function calcFee(aValue, aPcnt, aMinValue) {
    let feeAmount = (aValue / 100) * aPcnt;

    if (feeAmount < aMinValue && aPcnt > 0) {
        feeAmount = aMinValue;
    }

    return feeAmount;
}

function getFeeByChat(ctx, feeName) {
    const chatObj = ctx.chatsMap.get(ctx.chat.id);

    let fee = 0;

    if (chatObj) {
        fee = chatObj[feeName] !== undefined
            ? chatObj[feeName]
            : ctx.botConfig.devFee[feeName];
    }
    ctx.logger.debug("fee %s = %s", feeName, fee);
    return fee;
}

function getMinPotValue(ctx, coin) {
    return coin.potValue;
}

async function calcTokenFee(ctx, coin) {
    const node = await ctx.blockchain.getNode(coin.node);

    let fee;
    if (coin.name === node.feeCoin) {
        fee = await ctx.blockchain.getTxFee(coin);
    } else {
        const feeCoin = await ctx.blockchain.getCoinByName(node.feeCoin);
        const tempFee = await ctx.blockchain.getTxFee(feeCoin);
        const tokenPrice = await ctx.pricer.getPrice(coin.name, 'USD');
        const coinPrice  = await ctx.pricer.getPrice(feeCoin.name, 'USD');

        if (tokenPrice.value) {
            const rate = coinPrice.value / tokenPrice.value;
            fee = tempFee * rate;
        } else {
            fee = 0;
        }
    }

    return fee;
}

function getFeeItem(fee, node) {
    return {
        user_id: 0,
        user_name: "fee",
        wallet_address: node['feeWallet'],
        value: fee,
        txType: 0,
    };
}

function getBusdtUnlockDate(lockDate, multiplier) {
    const days5 = oneDayMs * 5; // 5 // 1
    const day30 = oneDayMs * 30; // 30 // 2

    const date = new Date();
    let nextStart = new Date();
    let nextEnd = new Date();
    let nextClaim = new Date();
    let nextClaimEnd = new Date();

    nextStart.setTime(lockDate.getTime());
    nextEnd.setTime(lockDate.getTime() + days5);
    const isLock = nextStart > date && date < nextEnd;

    const startDate = new Date(lockDate.getTime() - (360 * multiplier / 100) * oneDayMs);

    const daysUnr = (date.getTime() - startDate.getTime()) % day30 / oneDayMs ;
    const days = Math.round(daysUnr); // days
    const montUnr = (date.getTime() - startDate.getTime()) / day30 ;
    const months = Math.ceil(montUnr );   // months
    // console.log('daysUnr', daysUnr);
    // console.log('montUnr', montUnr);
    const claimWindow = (days === 0 || days < 5) && months > 0;
    // console.log('claimWindow', claimWindow);

    const plusMonth = claimWindow ? -1 : 0;
    nextClaim.setTime(startDate.getTime() + (months + plusMonth) * day30);
    nextClaimEnd.setTime(nextClaim.getTime() + days5);
    // console.log('startDate', startDate.toDateString());
    // console.log('nextClaim', nextClaim.toTimeString());

    return { isLock, nextStart, nextEnd, claimWindow, nextClaim, nextClaimEnd };
}

function stakeTimesCalc2(endTime, weight, startTime, stkVer = 2) {
    const round = 27;

    let stkObj = {};

    let rounds;
    if (stkVer === 2) {
        rounds = Math.round((weight  - 0.4) * 20);
    } else {
        rounds = Math.round((weight * 10 - 4));
    }
    if (rounds < 1) rounds = 1;

    const dateNow = new Date();
    let days = Math.floor((endTime.getTime() - dateNow.getTime()) / oneDayMs);
    if (days < 0) days = 0;

    const nround = rounds - Math.floor(days / round);

    let prgrs; // = Math.round(10000 - ((hours % (24 * round)) / (24 * round)) * 10000) / 100;

    let dateT = new Date(startTime.getTime() + 27 * oneDayMs);
    if (dateNow.getTime() > dateT.getTime()) {
        prgrs = 100;
    } else {
        prgrs =
            Math.round(10000 - ((dateT.getTime() - dateNow.getTime()) / (27 * oneDayMs)) * 10000) /
            100;
    }

    let claimDate = new Date();
    claimDate.setTime(dateT.getTime()); // set next claim to start + 27
    if (claimDate.getTime() < dateNow.getTime()) {
        // if next claim passed - means not claimed - calc by end time
        claimDate.setTime(endTime.getTime() - (rounds - nround) * round * oneDayMs);
    }
    if (claimDate.getTime() > endTime.getTime()) {
        claimDate.setTime(endTime.getTime());
    }

    let hours = (dateT.getTime() - dateNow.getTime()) / oneHourMs;
    // console.log('hours', hours);
    if (hours < 0) hours = (dateT.getTime() + oneDayMs * round - dateNow.getTime()) / oneHourMs;
    // console.log('hours', hours);

    stkObj.date = endTime;
    stkObj.claimDate = claimDate;
    stkObj.days = days; // days to end
    stkObj.round = nround;
    stkObj.maxRound = rounds;
    stkObj.prgrs = prgrs;
    stkObj.hours = Math.round(hours * 10) / 10; // hours to end
    return stkObj;
}

function stakeTimesCalc3(endTime, period) {
    let stkObj = {};

    const dateNow = new Date();

    let prgrs, days, hours, claimDate;
    if (endTime) {
        days = Math.floor((endTime.getTime() - dateNow.getTime()) / oneDayMs);
        if (days < 0) days = 0;

        claimDate = new Date(endTime.getTime() - period * oneDayMs);
        if (dateNow.getTime() > endTime.getTime()) {
            prgrs = 100;
        } else {
            prgrs =
                Math.round(10000 - ((endTime.getTime() - dateNow.getTime()) / (period * oneDayMs)) * 10000) /  100;
        }

        hours = (endTime.getTime() - dateNow.getTime()) / oneHourMs;
        if (hours < 0) hours = 0;
    } else {
        prgrs = 0;
        days = 0;
        hours = 0;
        claimDate = 0;
    }

    stkObj.date = endTime;
    stkObj.claimDate = claimDate;
    stkObj.days = days; // days to end
    stkObj.round = 1;
    stkObj.maxRound = 1;
    stkObj.prgrs = prgrs;
    stkObj.hours = Math.round(hours * 10) / 10;
    return stkObj;
}

function getUserActiveChains(user) {
    let chains = user['active_chains'] || [];
    // chains = coreChains.concat(chains);
    return coreChains.concat(chains);
}

async function getNetworks(blockchain) {
    const coins = await blockchain.getBaseCoins();
    coins.sort((a,b) => a.name.localeCompare(b.name));

    const arr = [];
    for (let coin of coins) {
        const prj = blockchain.getNode(coin.node);
        if (coin.tokenType) continue;
        const caipRev = reverseMap(caipMap);
        const netType = caipRev.get(prj.platform);
        const obj = {
            network: prj.networkName,
            id: coin.node,
            platform: prj.platform,
            coin: coin.name,
            chain_id: prj.chain_id,
            coin_cmc_id: coin['cmc_id'],
            caip2: netType ? `${netType}:${prj.chain_id}` : ''
        }
        arr.push(obj);
    }

    return arr;
}

//  ReEncode keys on Password change
async function changePassword(ctx, userId, oldPass, newPass) {
    const records = await ctx.dbasePk.getAllMnemonic(userId);

    for (let rec of records) {
        let dec, enc, mnemonic;
        let keys = {  };

        if (rec['mnemonic']) {
            dec = await decryptAsync(rec['mnemonic'], oldPass);
            mnemonic = await encryptAsync(dec, newPass);
        }

        for (let net of networks) {
            if (rec[net]) {
                dec = await decryptAsync(rec[net], oldPass);
                enc = await encryptAsync(dec, newPass);
                keys[net] = enc;
            }
        }

        await ctx.dbasePk.updateKeys(userId, rec.index, mnemonic, keys);
    }
}

async function checkEncryption(ctx, user) {
    let pass;
    if (await ctx.passwords.has(user.user_id)) {
        // hash = (await ctx.passwords.get(user.user_id)).hash;
        pass = (await ctx.passwords.get(user.user_id)).pass;
    }

    if (!pass) return false;

    // console.log(`hash: ${pass}`);

    for (let net of networks) {
        let keyVal;
        if (!user[`${net}_wallet_address`]) continue;
        const field = `${net}_wallet_key`;
        if (user[field]) {
            keyVal = user[field];
        } else {
            keyVal = await ctx.dbasePk.getKey(user.user_id, net, 0);
        }

        // console.log(`${net}: ${keyVal}`);

        try {
            await decryptAsync(keyVal, pass);
            // console.log(`decrypt OK`);
            // user[field] = await encryptAsync(val, hash);
        } catch (e) {  // if key value unencrypted - encrypt it
            user[field] = await encryptAsync(keyVal, pass);
            // console.log(`encrypting`);
        }
    }
    return pass;
}

async function transferKeys(ctx, user, write = true) {
    // check if keys still in user
    if (!user['ether_wallet_key']) {
        return;
    }

    let hash;
    if (user.encrypted) {
        hash = await checkEncryption(ctx, user);
        if (!hash) {
            await ctx.database.updateUser(user.user_id, { reencrypt: 1 });
        }
    }

    let userKeys = {};  // extract keys
    let unsetKeys = {
        password: 1
    };
    for (let [key, value] of Object.entries(user)) {
        if (key.indexOf('wallet_key') !== -1) {
            const name = key.replace('_wallet_key', '');
            userKeys[name] = value;
            unsetKeys[key] = 1;
        }
    }

    let keys = {};
    if (user.encrypted) {
        keys = userKeys;
    } else {
        const pass = generateRandomPassword();
        hash = pass;
        // hash = await bcrypt.hash(pass, saltRounds);
        // encode keys
        for (let [key, value] of Object.entries(userKeys)) {
            keys[key] = await encryptAsync(value, pass);
        }
        // update user - save pass
        if (write) {
            await ctx.database.updateUser(user.user_id, { pass_hash: pass });
        }
    }

    //  generate mnemonic
    let encrypted;
    if (hash) {
        const mnemonic = ctx.blockchain.generateMnemonic();
        encrypted = await encryptMnemonic(ctx.blockchain, mnemonic, hash);
    }

    // save keys and mnemonic
    if (write) {
        await ctx.dbasePk.saveMnemonic(user.user_id, encrypted, keys);
        await ctx.database.updateUser(user.user_id, unsetKeys, true);
    }

    return true;
}


async function saveEnabledTokens(ctx, values, unhide = false){
    const userId = ctx.from.id;
    const user = await ctx.database.getUser(userId);
    if (!user) return;

    const activeTokens = !user.active_tokens ? new Set() : new Set(user.active_tokens);
    const hiddenTokens = !user.hidden_tokens ? new Set() : new Set(user.hidden_tokens);
    const activeChains = !user.active_chains ? new Set() : new Set(user.active_chains);
    const hiddenChains = !user.hidden_chains ? new Set() : new Set(user.hidden_chains);

    for (const value of values.values()) {
        const coin = value.coin;
        if (coin.hiding || !coin.core) {
            const coinId = coin._id.toString();
            activeTokens.add(coinId);
            if (unhide) hiddenTokens.delete(coinId);
        }
        const chain = coin.node;
        if (!hiddenChains.has(chain)) {
            activeChains.add(chain);
        }
    }
    ctx.database.updateUser(userId, {
        active_tokens: Array.from(activeTokens),
        hidden_tokens: Array.from(hiddenTokens),
        active_chains: Array.from(activeChains)
    });
}

async function checkTokenVisible(ctx, userId, coin) {
    if (!coin.core || coin.hiding) {
        const newCtx = {
            from: {id : userId},
            database: ctx.database
        }
        const values = new Map();
        const value = {
            coin: coin
        }
        values.set(coin.name, value);
        await saveEnabledTokens(newCtx, values, true);
    }
}

async function findToken(ctx, network, address) {
    // search in DB
    let stateObj = {};
    const token = await ctx.database.getCoinByContract(network.toLowerCase(), address);
    if (token) {
        const msgObj = {
            currency: token.currency,
            node: token.node,
            name: token.name,
            contract: token.tokenContract || token.assetName || token.rri || token.tokenID || token.denom,
            satoshi: token.satoshi
        };
        if (ctx.i18n) {
            await ctx.replyWithHTML(ctx.i18n.t('tokenInfo', msgObj));
            await ctx.replyWithHTML(ctx.i18n.t('tokenFound'));
            if (!token.core) {
                await ctx.replyWithHTML(ctx.i18n.t('customTokenAddWarning'));
            }
            await checkTokenVisible(ctx, ctx.from.id, token);
            return ;
        } else {
            await checkTokenVisible(ctx, ctx.from.id, token);
            return token;
        }
    }

    let info;
    try {
        info = await ctx.blockchain.getTokenInfo(network.toLowerCase(), address);
    } catch (e) {
        ctx.logger.warn(`Error getting token: ${network} ${address}`);
        info = {};
    }
    if (!info.tokenSymbol) {
        if (ctx.i18n) {
            await ctx.replyWithHTML(ctx.i18n.t('tokenAddressError'));
        }
        return;
    }

    stateObj.tokenName = info.tokenName;
    stateObj.tokenSymbol = info.tokenSymbol;
    stateObj.tokenDecimal = info.tokenDecimal;
    stateObj.tokenType = info.tokenType;

    return stateObj;
}

async function addNewToken(ctx, stateObj) {
    const coreCoin = await ctx.blockchain.getCoinByName(stateObj.tokenSymbol);
    if (coreCoin) {
        stateObj.tokenSymbol += '_' + stateObj.network.toUpperCase();
    }

    if (ctx.i18n) {
        const msgObj = {
            currency: stateObj.tokenName,
            node: stateObj.network,
            name: stateObj.tokenSymbol,
            contract: stateObj.address,
            satoshi: stateObj.tokenDecimal
        };
        await ctx.replyWithHTML(ctx.i18n.t('tokenImported'));
        await ctx.replyWithHTML(ctx.i18n.t('tokenInfo', msgObj));
        await ctx.replyWithHTML(ctx.i18n.t('customTokenAddWarning'));
    }

    let tokenObj = {
        "name" : stateObj.tokenSymbol,
        "node" : stateObj.network.toLowerCase(),
        "currency" : stateObj.tokenName,
        "satoshi" : stateObj.tokenDecimal,
        "subMenu" : stateObj.network.toUpperCase(),
        decimals: 4
    }
    if (tokenObj.node === 'bnb') {
        tokenObj.assetName = stateObj.address;
        tokenObj.subMenu = 'BEP2';
    } else if (tokenObj.node === 'rdx') {
        tokenObj.rri = stateObj.address;
        tokenObj.subMenu = 'XRD';
    } else if (tokenObj.node === 'trx') {
        if (stateObj.tokenType === 'TRC10') {
            tokenObj.tokenID = stateObj.address;
        } else {
            tokenObj.tokenContract = stateObj.address;
        }
        tokenObj.tokenType = stateObj.tokenType;
    } else if (tokenObj.node === 'terra') {
        tokenObj.tokenType = stateObj.tokenType;
        if (stateObj.tokenType === 'CW20') {
            tokenObj.tokenContract = stateObj.address;
        } else {
            tokenObj.denom = stateObj.address;
        }
    } else {
        tokenObj.tokenType = stateObj.tokenType || "ERC20";
        tokenObj.tokenContract = stateObj.address;
    }
    await ctx.database.insertCoin(tokenObj);
    await ctx.database.cacheTokens();
    const coin = await ctx.database.getCoinByContract(tokenObj.node, stateObj.address);
    await checkTokenVisible(ctx, ctx.from.id, coin);

    return tokenObj;
}

async function getUserBalance(ctx, userId, coin = null, skipNulls = true, favs = false) {
    ctx.logger.info(`getUserBalance: (${userId}) ${coin ? coin.name : 'FULL'}`);
    const user = await ctx.database.getUser(userId); //isUserRegistered(ctx, userId, true);
    if (!user) return;

    let messageText = '';
    if (ctx.i18n) {
        messageText = ctx.i18n.t('balanceMessage');
        // if (favs) {
        //     messageText = ctx.i18n.t('favoritesBalBtn') + ' ' + messageText;
        // }
    }
    const values = new Map();
    const fiat = user.def_fiat || 'USD';

    if (coin) {
        const node = ctx.blockchain.getNode(coin.node);
        if (!node) return;

        const addr = getWalletAddress(ctx.blockchain, user, node);//user[`${node.platform}_wallet_address`];
        if (!addr) return;

        const balance = await ctx.blockchain.getBalance(coin, addr);
        const valueObj = { coin, balance };
        values.set(coin.name, valueObj);

        const price = await ctx.pricer.getPrice(coin.name, fiat, balance);
        messageText += `\n${coin.name}:  <code>${coinFormatStr(balance,4)} | ${price.str}</code>`;
        const contract = coin.tokenContract || coin.assetName || coin.rri || coin.tokenID || coin.denom || '';
        if (contract) {
            messageText += `\n(contract: <code>${contract}</code>)`;
        }
    } else {
        const coins = favs ? await ctx.blockchain.getFavUserCoins(userId) : await ctx.blockchain.getCoreAndUserCoins(userId) ;// getAllCoins();
        let sum = 0;
        let symbol = '';

        const keys = [];
        const promises = [];

        for (coin of coins) {
            if (coin['subMenu'] === 'TEST') { // exclude test tokens
                continue;
            }
            const node = ctx.blockchain.getNode(coin.node);
            if (!node) continue;
            const addr = getWalletAddress(ctx.blockchain, user, node); //user[`${node.platform}_wallet_address`];
            if (addr) {
                keys.push(coin);
                promises.push(ctx.blockchain.getBalance(coin, addr));
            }
        }

        try {
            const results = await Promise.all(promises);

            const arr = [];
            for (let i = 0; i < keys.length; i++) {
                const coin = keys[i];
                const balance = results[i];

                // if (! skipNulls) {
                //     messageText += `\n${balance}`;
                // } else {
                if ((!skipNulls) || (balance > 0)) {
                    const valueObj = { coin, balance };
                    values.set(coin.name, valueObj);
                    const price = await ctx.pricer.getPrice(coin.name, fiat, balance);
                    const obb = {
                        name: coin.name,
                        bal: balance,
                        val: price.value,
                        str: price.str,
                        id: coin._id.toString()
                    }
                    arr.push(obb);
                    sum += price.value;
                    symbol = price.symbol;
                    // messageText += `\n${coin.name}:  <code>${coinFormatStr(balance,4)} | ${price.str}</code>`;
                }
                // }
            }

            // sort by Fiat
            arr.sort((a, b) => b.val - a.val);
            const favTokens = user.fav_tokens || [];
            for (let ob of arr) {
                const apdx = favTokens.includes(ob.id) ? '🧡 ' : '';
                messageText += `\n${apdx}${ob.name}:  <code>${coinFormatStr(ob.bal,4)} | ${ob.str}</code>`;
            }
        } catch (e) {
            ctx.logger.warn(`Error getting Full Balance ${userId}`);
        }
        messageText += `\n == SUM ==  <code>${coinFormat(sum, 2)} ${symbol}</code>`;
    }

    return { messageText, values };
}

module.exports = {
    coinFormat,
    coinFormatStr,
    calcFee,
    getFeeItem,
    getFeeByChat,
    getMinPotValue,
    getUserBalance,
    formatNumber,
    getBusdtUnlockDate,
    stakeTimesCalc2,
    stakeTimesCalc3,
    getNetworks,
    findToken,
    checkTokenVisible,
    saveEnabledTokens,
    addNewToken,
    transferKeys,
    checkEncryption,
    changePassword,
    calcTokenFee,
    isPromise,
    getWalletAddress,
    numberWithCommas,
    convertHexToUtf8,
    getUserActiveChains
};
