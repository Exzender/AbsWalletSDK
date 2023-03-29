const AbwSDK = require('./../src');

const apiUrl = process.env.API_URL;
const apiKey = process.env.API_KEY;

async function test() {
    // NOTE set url to API server address
    const abwSDK = AbwSDK({ apiKey: apiKey, url: apiUrl});

    try {
        // NOTE 1st param - always take NET list from API, 2nd param - enable test chains
        await abwSDK.initBlockchain(true, true);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }

    let chain = 'clo';
    let token = 'AWC';
    let targetAddress = '0x0'; // NOTE blockchain address

    try {
        let wallet = await abwSDK.generateWallet(chain);
        console.log(wallet);

        /**
         *  Generate TX locally and broadcast
         */

        // if you want to know platform where this address is valid
        const valid = await abwSDK.isAddressValid(targetAddress);
        console.log(valid);

        // just check validity of address on known chain
        const valid2 = await abwSDK.isAddressValid(targetAddress, chain);
        console.log(valid2);

        const txPayload = {
            sourceAddress: wallet.address,
            targetAddress: targetAddress,
            token: token,
            amount: 1,
            // NOTE payload can have memo included
            memo: 'test_tx'
        }


        // NOTE for Aptos chain need to check target account existence
        const isAccount = abwSDK.checkAndCreateAptosAccount(targetAddress, wallet.key);
        if (isAccount) {
        const tx = await abwSDK.buildTransaction(chain, txPayload);
        console.log(tx);
            const signed = await abwSDK.signTransaction(chain, tx, wallet.key)
            console.log('--signed:');
            console.log(signed);
            const res = await abwSDK.broadcastTransaction(chain, signed);
            console.log(res);
        }

        /**
         *  Send TX with key
         */
        const res = await abwSDK.sendTransaction(chain, wallet.key, txPayload);
        console.log(res);

        /**
         *  Get TX from blockchain
         */
        const tx = await abwSDK.getTransaction('clo', '0xc5e48f98282ccfbe6532c0efeb4adc2b05dd418bf83b3f86bd536407b55c4f78');
        console.log(tx);

        /**
         *  Get TX count (nonce) from blockchain
         */
        const txcnt = await abwSDK.getTransactionCount('clo', '');
        console.log(txcnt);

        /**
         *  Get block info from blockchain
         */
        const lastblock = await abwSDK.getLastBlock('solana');
        console.log(lastblock);

        const block = await abwSDK.getBlock('solana', 12345);
        console.log(block);

        /**
         *  Get balance from blockchain
         */
        const balance = await abwSDK.getBalance('clo', '');
        console.log(balance);

        const balanceTokens = await abwSDK.getTokensOnWallet('clo', '');
        console.log(balanceTokens);

        /**
         *  Get supported tokens from API
         */
        const tokens = await abwSDK.getTokens('bttc');
        // console.log(tokens);
        for (let token of tokens) {
            const ti = await abwSDK.getTokenInfo(token.code);
            console.log(ti);
        }

        /**
         *  Get address from private key
         */
        const address = await abwSDK.addressFromKey(chain, wallet.key);
        console.log(address)
    } catch (e) {
        console.error(e.toString());
    } finally {
        process.exit(0);
    }
}

test().then();