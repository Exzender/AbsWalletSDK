/**
 * To use in NODE.js You must edit walletconnect src file to make local file storage work properly
 * ./node_modules/@walletconnect/keyvaluestorage/dist/cjs/node-js/index.js
 * just comment this last line in constructor: this.databaseInitialize(this.db);
 *
 * Provide env var WC_PROJECT_ID - WalletConnect projectId (see more at:
 * https://docs.walletconnect.com/2.0/web3modal/configuration )
 *
 * WC 2.0 data automatically saved in ${homedir}/.abwsdk/wc2db
 */

const WConnect = require('./wconnect');

module.exports = {
    ...WConnect
}