const AbwSDK = require("../src");
const abwDB = require("../src/database");
const abwWC = require("../src/wconnect");

let abwSDK;

async function onWcSign(params) {
    console.log('onWcSign: ', params);
    //
    // NOTE reject
    // await abwWC.rejectRequest(params.user_id, params.peer_id, params.rq_id);
    //
    // NOTE approve
    const key = await abwDB.getWalletKey(params.user_id, params.nodeName);
    try {
        const res = await abwWC.approveRequest(params, key);
        console.log(res);
    } catch (e) {
        console.error(e);
    }
}

async function onWcSwitchChain(params) {
    console.log('wcSwitchChain: ');
    console.log(params);
}

async function onWcConnected(params) {
    console.log('wcConnected: ', params);
    let connInfo = await abwWC.getConnectInfo(params.user_id, params.peer_id);
    console.log(connInfo);

    const chainInfo = await abwSDK.getChainById(connInfo.chainId);
    console.log(chainInfo);
}

async function onWcDisconnected(params) {
    console.log('onWcDisconnected:');
    console.log(params);
}

async function onWcPing(params) {
    console.log('onWcPing:');
    console.log(params);
}

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
    let wcString = '...'; // paste here WC1.0 or WC2.0 connection string

    try {

        // Meta information for WalletConnect
        const clientMeta = {
            description: "AbsoluteWalletSDK",
            url: "https://absolutewallet.com",
            icons: ["https://absolutewallet.com/images/logo.png"],
            name: "AbsoluteWalletSDK",
        };

        await abwDB.init(blockchain);
        await abwWC.initialize(blockchain, abwDB, clientMeta);

        const evHandler = abwWC.getEventsHandler();


        evHandler.on('wcConnected', onWcConnected);
        evHandler.on('wcPing', onWcPing);
        evHandler.on('wcDisconnected', onWcDisconnected);
        evHandler.on('wcSwitchChain', onWcSwitchChain);

        // object, received with wcSign event have this info for the user
        //     dapp: - dApp name - source of request
        //     network:  - network (chain) name
        //     params: - data to be signed (message / typed data / transaction)
        //     version: - wallet connect version
        evHandler.on('wcSign', onWcSign);

        // NOTE view example in "userdb.js" on creating and handling users
        const user = await abwDB.getUser(userId);
        console.log(user);

        // NOTE do connect once - on next run it will be restored automatically
        console.log('Creating new connection:');
        try {
            await abwWC.createConnection(user, wcString);
        } catch (e) {
            console.error(e);
        }

        // await abwWC.switchChain(userId, r.peer_id, 56); // 56 - BSC net
        // connInfo = await abwWC.getConnectInfo(userId, r.peer_id);
        // console.log(connInfo);

        // get active sessions for user
        const conn = await abwDB.getWalletConnects(user.user_id);
        console.log(conn);
    } catch (e) {
        console.error(e.toString());
    } finally {
        // process.exit(0);
    }
}

test().then();