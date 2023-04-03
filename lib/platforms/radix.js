const axios = require('axios');
const BigNumber = require('bignumber.js');

const { AccountAddress, SigningKey } = require( '@radixdlt/account');
const { Mnemonic, HDMasterSeed, HDPathRadix } = require('@radixdlt/crypto');
const network = 'mainnet'; //'STOKENET'//'MAINNET';

const rpc = 'https://mainnet-gateway.radixdlt.com/';

class RadixPlatform {
    constructor() {
    }

    async setNodes(nodes) {
        if (nodes[0]) {
            this.node = nodes[0];
        } else {
            this.node = null;
        }
    }

    async registerWallet(mnemonicStr) {
        const mnemonic = mnemonicStr ? Mnemonic.fromEnglishPhrase(mnemonicStr).value : Mnemonic.generateNew();
        let encodedString = Buffer.from(mnemonic.entropy).toString('base64');

        const hdMasterSeed = HDMasterSeed.fromMnemonic({ mnemonic })
        const hdPath = HDPathRadix.create({
            address: { index: 0, isHardened: true },
        });

        const signingKey = SigningKey.fromHDPathWithHDMasterSeed({
            hdPath,
            hdMasterSeed,
        });

        const address = AccountAddress.fromPublicKeyAndNetwork({
            publicKey: signingKey.publicKey,
            network: network
        });
        return { walletAddress: address.toString(), walletKey: encodedString };
    }

    addressFromKey(key) {
        const signingKey = this.getSigningKey(key);
        return AccountAddress.fromPublicKeyAndNetwork({
            publicKey: signingKey.publicKey,
            network: network
        }).toString();
    }

    getSigningKey(entropy) {
        const dec = Buffer.from(entropy, 'base64');
        const mnemonic = Mnemonic.fromEntropy({entropy: dec}).unwrapOr(null);
        const hdMasterSeed = HDMasterSeed.fromMnemonic({ mnemonic })
        const hdPath = HDPathRadix.create({
            address: { index: 0, isHardened: true },
        });
        return SigningKey.fromHDPathWithHDMasterSeed({
            hdPath,
            hdMasterSeed,
        })
    }

    genTxObj(txS) {
        const dest = [];
        const destItems = [];

        for (let i = 0; i < txS.length; i++) {
            const txObj = txS[i];
            dest.push({to_account: txObj.destItem.address,
                value: txObj.tx.value
            });
            destItems.push(txObj.destItem);
        }

        return  {
            sourceItem: txS[0].sourceItem,
            outputs: dest,
            destItems: destItems,
            token: txS[txS.length-1].tx.coin.name,
            coin: txS[txS.length-1].tx.coin,
        };
    }

    async buildTransaction(node, txObj) {
        const srcObj = txObj.sourceItem;
        const outObjs = txObj.outputs;
        const coin = txObj.coin;

        try {
            return this.buildTx(srcObj.address, outObjs, coin.contract );
        } catch (error) {
            throw new Error (`Radix Build TX error ${error.toString()}` );
        }
    }

    async buildTx(fromAddress, outObjs, rri) {
        const params = {fromAddress, outObjs, rri};
        let data = {
            "network_identifier": {
                "network": network
            }
        };
        let gwUrl = 'transaction/build';
        const actionsArray = [];
        let bnValue = new BigNumber('10').pow('18');
        for (let output of params.outObjs) {
            actionsArray.push({
                type: 'TransferTokens',
                from_account: { "address": params.fromAddress },
                to_account: { "address": output.to_account },
                amount: {
                    token_identifier: { rri: params.rri },
                    value: bnValue.multipliedBy(output.value).toFixed()
                }
            });
        }
        data['actions'] = actionsArray;
        data['fee_payer'] = { address: params.fromAddress };
        data['disable_token_mint_and_burn'] = true;
        const config = {
            method: 'post',
            url: `${rpc}${gwUrl}`,
            headers: { 'Content-Type': 'application/json' },
            data : data
        };

        console.log(config);

        const res = await axios(config);
        return res.data;
    }

    async signTransaction(node, transaction, key) {
        const signingKey = this.getSigningKey(key);

        const decoded = Buffer.from(transaction.transaction_build.payload_to_sign, 'hex');
        const signed = await new Promise((resolve, reject) => {
            signingKey.sign({ hashOfBlobToSign: decoded }).subscribe({
                next: (res) => resolve(res),
                error: (err) => reject(err)
            });
        });

        const signedEdr = signed.toDER();

        let data = {
            "network_identifier": {
                "network": network
            }
        };
        let gwUrl = 'transaction/finalize';
        data['unsigned_transaction'] = transaction.transaction_build.unsigned_transaction;
        data['signature'] = {
            bytes: signedEdr,
            public_key: { hex: signingKey.publicKey.toString(true) }
        };
        data['submit'] = false;
        const config = {
            method: 'post',
            url: `${rpc}${gwUrl}`,
            headers: { 'Content-Type': 'application/json' },
            data : data
        };

        try {
            const res = await axios(config);
            return res.data.signed_transaction;
        } catch (error) {
            throw new Error (`Radix Sign TX error ${error.toString()}` );
        }
    }

    checkAddress(address) {
        let acc = AccountAddress.fromUnsafe(address).unwrapOr(false);
        return AccountAddress.isAccountAddress(acc);
    }
}

exports.RadixPlatform = RadixPlatform;
