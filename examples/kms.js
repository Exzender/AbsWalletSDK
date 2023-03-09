const AbwSDK = require('./../src');
const kms = require('./../src/kms');

const apiUrl = process.env.API_URL;
const apiKey = process.env.API_KEY;
const password = process.env.UNLOCK_PASS;

async function test() {
    const abwSDK = AbwSDK({ apiKey: apiKey, url: apiUrl});

    let chain = 'clo';

    try {
        let wallet = await abwSDK.generateWallet(chain);
        console.log(wallet);
        /**
         *  Store wallet in KMS
         */
        const res = kms.storeWallet(wallet, chain, password);
        console.log(res);

        const oldWallet = kms.getWallet(res.id, password);
        console.log('Get wallet: ', oldWallet);

        const address = kms.getAddress(res.id, password);
        console.log('Get address: ', address);

        const key = kms.getPrivateKey(res.id, password);
        console.log('Get key: ', key);

        const chainWallets = kms.getWalletsByChain(chain, password);
        console.log('chainWallets: ', chainWallets);

        const mnemoWallets = kms.getWalletByMnemonic(res.mnemonic, password, chain);
        console.log('mnemoWallets: ', mnemoWallets);

        kms.removeWallet(res.id, password);

        const chainWallets2 = kms.getWalletsByChain(chain, password);
        console.log('chainWallets2: ', chainWallets2);

    } catch (e) {
        console.error(e.toString());
    } finally {
        process.exit(0);
    }
}

test().then();