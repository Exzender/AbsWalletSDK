"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMessageSignature = exports.verifyTransactionSignature = exports.serialiseTransaction = exports.deserialiseTransaction = void 0;
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
function deserialiseTransaction(seralised) {
    const resolveInstructionData = (data) => {
        if (!data)
            return Buffer.from([]);
        return typeof data === 'string'
            ? Buffer.from(bs58_1.default.decode(data))
            : Buffer.from(data);
    };
    const tx = new web3_js_1.Transaction({
        recentBlockhash: seralised.recentBlockhash,
        feePayer: new web3_js_1.PublicKey(bs58_1.default.decode(seralised.feePayer)),
    });
    tx.add(...seralised.instructions.map(x => ({
        programId: new web3_js_1.PublicKey(bs58_1.default.decode(x.programId)),
        data: resolveInstructionData(x.data),
        keys: x.keys.map(y => (Object.assign(Object.assign({}, y), { pubkey: new web3_js_1.PublicKey(bs58_1.default.decode(y.pubkey)) }))),
    })));
    seralised.partialSignatures.forEach(partial => {
        tx.addSignature(new web3_js_1.PublicKey(bs58_1.default.decode(partial.pubkey)), Buffer.from(bs58_1.default.decode(partial.pubkey)));
    });
    return tx;
}
exports.deserialiseTransaction = deserialiseTransaction;
function serialiseTransaction(tx) {
    return {
        feePayer: tx.feePayer.toBase58(),
        recentBlockhash: tx.recentBlockhash,
        instructions: tx.instructions.map(instruction => ({
            programId: instruction.programId.toBase58(),
            keys: instruction.keys.map(key => (Object.assign(Object.assign({}, key), { pubkey: key.pubkey.toBase58() }))),
            data: bs58_1.default.encode(instruction.data),
        })),
        partialSignatures: tx.signatures.map(sign => ({
            pubkey: sign.publicKey.toBase58(),
            signature: bs58_1.default.encode(sign.signature),
        })),
    };
}
exports.serialiseTransaction = serialiseTransaction;
function verifyTransactionSignature(address, signature, tx) {
    return tweetnacl_1.default.sign.detached.verify(tx.serializeMessage(), bs58_1.default.decode(signature), bs58_1.default.decode(address));
}
exports.verifyTransactionSignature = verifyTransactionSignature;
function verifyMessageSignature(address, signature, message) {
    return tweetnacl_1.default.sign.detached.verify(bs58_1.default.decode(message), bs58_1.default.decode(signature), bs58_1.default.decode(address));
}
exports.verifyMessageSignature = verifyMessageSignature;
//# sourceMappingURL=solana_utils.js.map