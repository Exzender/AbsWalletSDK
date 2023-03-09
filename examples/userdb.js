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

        const us = await abwDB.getUsers({wal: user.wal});
        console.log(us);

    } catch (e) {
        console.error(e.toString());
    } finally {
        process.exit(0);
    }
}

test().then();