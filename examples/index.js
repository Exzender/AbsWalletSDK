const AbwSDK = require('./../src');

const apiKey = '';
const apiUrl = '';

async function test() {
    // NOTE set ignoreSsl = true for local work with self-signed certs on API server
    // NOTE set url to API server address
    const abwSDK = AbwSDK({ apiKey: apiKey, url: apiUrl});
    try {
        await abwSDK.initBlockchain();
    } catch (e) {
        console.log(e);
        process.exit(1);
    }

    try {
        // test TX sending
        const wallet = await abwSDK.generateWallet('clo');
        console.log('wallet: ', wallet);

        const txPayload = {
            sourceAddress: wallet.address,
            targetAddress: wallet.address,
            token: 'SOY',
            amount: 1
            // NOTE payload can have memo included
        }

        const chain = 'clo';

        const tx = await abwSDK.buildTransaction(chain, txPayload);
        console.log(tx);
        const signed  = await abwSDK.signTransaction(chain, tx, wallet.key)
        console.log(signed);
        const res = await abwSDK.broadcastTransaction(chain, signed);
        console.log(res);

        // const res = await abwSDK.sendTransaction('clo', wallet.key, txPayload);
        // console.log(res);

        // const tx = await abwSDK.getTransaction('clo', '0xc5e48f98282ccfbe6532c0efeb4adc2b05dd418bf83b3f86bd536407b55c4f78');
        // console.log(tx);
        //
        // const txcnt = await abwSDK.getTransactionCount('clo', '');
        // console.log(txcnt);

        // const lastblock = await abwSDK.getLastBlock('solana');
        // console.log(lastblock);
        //
        // const block = await abwSDK.getBlock('solana', 12345);
        // console.log(block);

        // const balance = await abwSDK.getBalance('clo', '');
        // console.log(balance);
        //
        // const balanceTokens = await abwSDK.getTokensOnWallet('clo', '');
        // console.log(balanceTokens);


        // const tokens = await abwSDK.getTokens('bttc');
        // // console.log(tokens);
        // for (let token of tokens) {
        //     const ti = await abwSDK.getTokenInfo(token.code);
        //     console.log(ti);
        // }

        // const wallet = await abwSDK.generateWallet('trx');
        // console.log('wallet: ', wallet);
        // const address = await abwSDK.addressFromKey('trx', wallet.key);
        // console.log(address)
    } catch (e) {
        console.error(e.toString());
    } finally {
        process.exit(0);
    }
}

test().then();