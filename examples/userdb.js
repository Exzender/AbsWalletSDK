const AbwSDK = require('./../src');
const abwDB = require('../src/database');

let abwSDK;

const apiUrl = process.env.API_URL;
const apiKey = process.env.API_KEY;

async function test() {
    console.log(apiUrl);

    abwSDK = AbwSDK({ apiKey: apiKey, url: apiUrl});

    let blockchain;

    try {
        blockchain = await abwSDK.initBlockchain(true);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }

    let userId = 12345;
    let chain = 'clo';

    try {
        let allWallets = await abwSDK.generateAllWallets();
        console.log(allWallets);

        const user = {
            user_id: userId,
            wa: 'something',
            param: {v1: 1, v2: 'kk'},
            wallet: allWallets
        }

        console.log(user);


        // initialize Mongo DB
        await abwDB.init(blockchain);

        // store or update user to DB
        await abwDB.storeUser(user);

        // get stored user from DB
        const u = await abwDB.getUser(userId);
        console.log(u);

        // get private key from DB
        const w = await abwDB.getWalletKey(userId, chain);
        console.log(w);

        // get processed/converted address from user
        const adr = await abwDB.getWalletAddress(u, chain);
        console.log(adr);

        // get mnemonic phrase from user
        const m = await abwDB.getWalletMnemonic(userId);
        console.log(m);

        const us = await abwDB.getUsers({wa: user.wa});
        console.log(us);

        /** Enabling/disabling active chains */
        const chains = abwDB.getUserChains(user);
        console.log(chains);

        let newChains = await abwDB.switchEnabledChains(user, [], true);
        console.log(newChains);

        newChains = await abwDB.switchEnabledChains(user, [], false);
        console.log(newChains);

        newChains = await abwDB.switchEnabledChains(user, ['solana'], true);
        console.log(newChains);

        /** Enabling/disabling active tokens */
        const tokens = abwDB.getUserCoins(user);
        console.log(tokens);

        // can enable all found tokens returned by getTokensOnWallet
        const address = await abwDB.getWalletAddress(user, chain);
        const balances = await abwSDK.getTokensOnWallet(chain, address);
        // this will enable all found tokens for user
        let newTokens = await abwDB.saveTokensFromBalance(chain, user, balances['balance']);
        console.log(newTokens);

        // or just switch on/off list of tokens
        // base coins of blockchains can not be hidden
        const list = ['CCCAKE', 'VVT'];
        newTokens = await abwDB.switchEnabledTokens(user, list, false);
        console.log(newTokens);

        /** Archive user - will delete user with it's wallets - and store in archive tables */
        // await abwDB.archiveUser(userId);
        //
        // let a = await abwDB.getUser(userId);
        // console.log(a);

        /** Renew/replace user's wallets */
        // get user
        // const r = await abwDB.getUser(userId);

        // archive user's DB record
        // await abwDB.archiveUser(userId);

        // replace/recreate wallets
        // r.wallet = await abwSDK.generateAllWallets();

        // store updated user in DB
        // await abwDB.storeUser(user);

    } catch (e) {
        console.error(e.toString());
    } finally {
        process.exit(0);
    }
}

test().then();