const AbwSDK = require('./../src');
const kms = require('./../src/kms');

const apiUrl = process.env.API_URL;
const apiKey = process.env.API_KEY;
const password = process.env.UNLOCK_PASS;

const firstWalletId = '';
const secondWalletId = '';
const firstMnemonic = 'ball enjoy renew claim elder napkin soon loyal brave rail capable illness';

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

    const chain = 'clo';

    try {
        // test TX sending
        const mnemonic = abwSDK.generateMnemonic(12);
        console.log(mnemonic);

        let wallet = abwSDK.generateWallet(chain, mnemonic);
        // console.log('wallet: ', wallet);

        /**
         *  Store wallet in KMS
         */
        // const res = kms.storeWallet(wallet, chain, password);
        // console.log(res);
        //
        // const oldWallet = kms.getWallet(firstWalletId, password);
        // console.log('Get wallet: ', oldWallet);
        //
        // const address = kms.getAddress(firstWalletId, password);
        // console.log('Get address: ', address);
        //
        // const key = kms.getPrivateKey(firstWalletId, password);
        // console.log('Get key: ', key);

        const chainWallets = kms.getWalletsByChain(chain, password);
        console.log('chainWallets: ', chainWallets);

        // const mnemoWallets = await kms.getWalletByMnemonic(firstMnemonic, password, chain);
        // console.log('mnemoWallets: ', mnemoWallets);

        // kms.removeWallet(secondWalletId, password);
        //
        // const chainWallets2 = await kms.getWalletsByChain(chain, password);
        // console.log('chainWallets2: ', chainWallets2);

        /**
         *  Generate TX locally and broadcast
         */

        // const txPayload = {
        //     sourceAddress: wallet.address,
        //     targetAddress: wallet.address,
        //     token: 'SOY',
        //     amount: 1
        //     // NOTE payload can have memo included
        // }
        //

        //
        // const tx = await abwSDK.buildTransaction(chain, txPayload);
        // console.log(tx);
        // const signed  = await abwSDK.signTransaction(chain, tx, wallet.key)
        // console.log(signed);
        // const res = await abwSDK.broadcastTransaction(chain, signed);
        // console.log(res);

        /**
         *  Send TX with key
         */
        const res = await abwSDK.sendTransaction('clo', wallet.key, txPayload);
        // console.log(res);

        /**
         *  Get TX from blockchain
         */
        // const tx = await abwSDK.getTransaction('clo', '0xc5e48f98282ccfbe6532c0efeb4adc2b05dd418bf83b3f86bd536407b55c4f78');
        // console.log(tx);
        //
        /**
         *  Get TX count (nonce) from blockchain
         */
        // const txcnt = await abwSDK.getTransactionCount('clo', '');
        // console.log(txcnt);

        /**
         *  Get block info from blockchain
         */
        // const lastblock = await abwSDK.getLastBlock('solana');
        // console.log(lastblock);
        //
        // const block = await abwSDK.getBlock('solana', 12345);
        // console.log(block);

        /**
         *  Get balance from blockchain
         */
        // const balance = await abwSDK.getBalance('clo', '');
        // console.log(balance);
        //
        // const balanceTokens = await abwSDK.getTokensOnWallet('clo', '');
        // console.log(balanceTokens);

        /**
         *  Get supported tokens from API
         */
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