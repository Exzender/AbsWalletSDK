const { Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const { deserialiseTransaction } = require('./solana_utils');

class SolanaPlatform {
    constructor(apiClient) {
        this.rpcMap = new Map();
        this.apiClient = apiClient;
        this.convertHexToUtf8 = require('./../blockchain/utils').convertHexToUtf8;
    }

    async setNodes(nodes) {
        if (nodes[0]) {
            this.node = nodes[0];
        } else {
            this.node = null;
            this.rpcMap.clear();
        }
    }

    async registerWallet(seed) {
        let wallet;

        if (seed) {
            const uArray = new Uint8Array(seed.toJSON().data.slice(0,32));
            wallet = Keypair.fromSeed(uArray);
        } else {
            wallet = Keypair.generate();
        }
        const address = wallet.publicKey.toString();
        const privateKey = Buffer.from(wallet.secretKey).toString('base64');
        return { walletAddress: address, walletKey: privateKey };
    }

    addressFromKey(key) {
        const uArray = Buffer.from(key, 'base64');
        const wallet = Keypair.fromSecretKey(uArray);
        return wallet.publicKey.toString();
    }

    genTxObj(txS) {
        return txS[0];
    }

    // TODO not finished
    async buildTransaction(node, txObj) {
        // const web = this.rpcMap.get(node.name);
        const srcObj = txObj.sourceItem;
        const destObj = txObj.destItem;
        const tx = txObj.tx;
        const aValue = tx.value;
        const coin = tx.coin;
        const isToken = coin['type'] === 'SPL';

        const publicKey = new PublicKey(srcObj.address);
        const toPublicKey = new PublicKey(destObj.address);
        let signed = new Transaction();
            if (isToken) { // TODO implement - requires PK to create destination Token Account
                throw new Error (`Solana SPL token transactions not implemented yet` );
                // const keyArray = new Uint8Array(Buffer.from(srcObj.key, 'base64'));
                // const payer = Keypair.fromSecretKey(keyArray);
                // let tokenInfo = await this.getToken(web, payer, coin['tokenContract']);
                // tokenInfo.decimals = coin['satoshi'];
                // let splTransfers = [{recipient: toPublicKey, value: aValue}  ];
                // signed = await this.buildSplTokenBatchTransferTx(web, payer, tokenInfo, splTransfers);
            } else {
                signed.add(SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: toPublicKey,
                    lamports: aValue * LAMPORTS_PER_SOL
                }));
            }
        const { blockhash, lastValidBlockHeight } = await this.apiClient.getLastBlockHash(node.name);
        signed.recentBlockhash = blockhash;
        signed.lastValidBlockHeight = lastValidBlockHeight;

        return signed;
    }

    async signTransaction(node, transaction, key) {
        const keyArray = new Uint8Array(Buffer.from(key, 'base64'));
        const payer = Keypair.fromSecretKey(keyArray);
        try {
            transaction.sign(payer);
            return transaction.serialize({ requireAllSignatures: false }).toString('hex');
        } catch (error) {
            throw new Error (`Solana Sign TX error ${error.toString()}` );
        }
    }

    async getToken(connection, sender, tokenContractAddress) {
        const tokenMint = new PublicKey(tokenContractAddress);
        const token = new splToken.Token(connection, tokenMint, splToken.TOKEN_PROGRAM_ID, sender);
        return {token: token};
    }

    async buildSplTokenBatchTransferTx(connection, sender, tokenInfo, transfers) {
        let token = tokenInfo.token;
        let senderTokenAccount = await token.getOrCreateAssociatedAccountInfo(sender.publicKey);
        let transferedRecipients = {};
        let transaction = new Transaction();
        for (let i = 0; i < transfers.length; i++) {
            let transfer = transfers[i];
            let recipient = transfer.recipient;
            let amount = transfer.value * Math.pow(10, tokenInfo.decimals);
            let aTokenAddress =
                await this.getAssociatedTokenAddress(connection, recipient, token.publicKey) ||
                transferedRecipients[recipient];
            if (aTokenAddress) {
                transaction = transaction.add(
                    splToken.Token.createTransferInstruction(
                        splToken.TOKEN_PROGRAM_ID,
                        senderTokenAccount.address,
                        aTokenAddress,
                        sender.publicKey,
                        [],
                        amount
                    )
                );
            } else {
                aTokenAddress = await this.calcAssociatedTokenAddress(recipient, token.publicKey);
                transaction = transaction.add(
                    splToken.Token.createAssociatedTokenAccountInstruction(
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                        splToken.TOKEN_PROGRAM_ID,
                        token.publicKey,
                        aTokenAddress,
                        recipient,
                        sender.publicKey
                    ),
                    splToken.Token.createTransferInstruction(
                        splToken.TOKEN_PROGRAM_ID,
                        senderTokenAccount.address,
                        aTokenAddress,
                        sender.publicKey,
                        [],
                        amount
                    )
                );
            }
            transferedRecipients[recipient] = aTokenAddress;
        }

        return transaction
    }

    async signExtMessage(params, key) {
        const keyArray = new Uint8Array(Buffer.from(key, 'base64'));

        let msg = this.convertHexToUtf8(params.message);
        const signature = nacl.sign.detached(bs58.decode(msg), keyArray);
        const bs58Signature = bs58.encode(signature);

        return { signature: bs58Signature };
    }

    async signExtTransaction(params, key) {
        const keyArray = new Uint8Array(Buffer.from(key, 'base64'));
        const payer = Keypair.fromSecretKey(keyArray);

        const serialisedTransaction = {
            feePayer: params.txConfig.feePayer,
            instructions: params.txConfig.instructions,
            recentBlockhash: params.txConfig.recentBlockhash,
            partialSignatures: params.txConfig.partialSignatures || []
        }
        const transaction = deserialiseTransaction(serialisedTransaction);

        transaction.sign(payer);

        const primarySigPubkeyPair = transaction.signatures[0];

        if (!primarySigPubkeyPair.signature) {
            console.error('Missing solana signature');
        }

        return {signature: bs58.encode(primarySigPubkeyPair.signature)};
    }

    checkAddress() {
        return true;
    }
}

exports.SolanaPlatform = SolanaPlatform;
