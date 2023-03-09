const { parseUri } = require('@walletconnect/utils');
const fs = require('fs');

const { caipMap } = require('../const');
const { WConnector } = require('./wconnector');
const { WConnector2 } = require('./wconnector2');
const EventEmitter = require('events');
const {isPathExists} = require('../utils');

const homedir = require('os').homedir();
const wc2LocalPath = `${homedir}/.abwsdk/wc2db`;

/** Globals */
let clientMeta;
let database;
let blockchain;
let eventsHandler;

const wconnectMap = new Map();

class WcEventsHandler extends EventEmitter{
    constructor() {
        super();
        this.wcError = this.wcError.bind(this);
        this.wcConnected = this.wcConnected.bind(this);
        this.wcDisconnected = this.wcDisconnected.bind(this);
        this.wcSwitchChain = this.wcSwitchChain.bind(this);
        this.wcSendTransaction = this.wcSendTransaction.bind(this);
        this.wcEthSign = this.wcEthSign.bind(this);
        this.wcSessionProposal = this.wcSessionProposal.bind(this);
        this.wcSessionPing = this.wcSessionPing.bind(this);
    }

    async wcError(userId, text, error) {
        console.warn(error);
        this.emit('wcError', {user_id: userId, message: text, error});
    }


    /**
     * WC2 events
     */

    async wcSessionProposal(params, connector) {
        console.debug(`WC2 EVENT: session  proposal`);

        if (!connector) return;

        const userId = params.userId;

        // NOTE active chains check not implemented

        const rqNamespaces = params.params['requiredNamespaces'];
        let namespaces = {};

        let chainId;

        for (let key of Object.keys(rqNamespaces)) {
            // Object.keys(rqNamespaces).forEach((key) => {
            const accounts = [];
            for (let chain of rqNamespaces[key].chains) {
                // rqNamespaces[key].chains.map(chain => {
                const caipName = chain.split(':');
                const platform = caipMap.get(caipName[0]);
                if (!platform) {
                    await connector.rejectSession(params.rqId, params.params.proposer.publicKey);
                    const str = `WC2 dApp requires UNSUPPORTED network : <code>${caipName[0]}</code>.`;
                    throw new Error(str);
                }

                chainId = caipName[1];
                if (!isNaN(Number(chainId))) chainId = Number(chainId);

                const node = (await blockchain.getChainById(chainId));// || {name: 'not_supported', networkName: 'unknown'} ;

                let address;
                if (node) {
                    address = await database.getWalletAddress(params.user, node.name);
                } else {
                    await connector.rejectSession(params.rqId, params.params.proposer.publicKey);
                    const str = `WC2 dApp requires UNSUPPORTED network ID : ${node.name}.`;
                    throw new Error(str);
                }

                console.log(address);
                accounts.push(`${chain}:${address}`);
            }
            namespaces[key] = {
                accounts,
                methods: rqNamespaces[key].methods,
                events: rqNamespaces[key].events
            }
        }

        const res = await connector.approveSession(params.rqId, namespaces);

        //NOTE WC2 sessions saved by SDK in Loki DB
        saveConnectSession(userId, res, connector);

        const session = {
            chainId,
            peerId: res,
            peerMeta: params.params.proposer.metadata
        };
        connector.setSession(session);

        const dbObj = {
            session,
            user_id: userId,
            url: params.params.proposer.metadata.url,
            peer_id: res,
            date: new Date(),
            version: 2,
            key: res
        }

        await database.insertWalletConnect(dbObj);
        // console.log('Topic', res);
        this.emit('wcConnected', {user_id: userId, peer_id: res});
    }

    async wcSessionPing(params, connector) {
        console.debug(`WC2 EVENT: session  ping: ${params.userId} | ${params.peerId}`);
        const session = connector.session(params.peerId);
        const msgObj = {
            dApp: session.peerMeta.name,
            link: session.peerMeta.url,
            user_id: params.userId,
            peer_id: params.peerId
        };
        this.emit('wcPing', msgObj);
    }

    /**
     * WC1 events
     */

    async wcConnected(userId, session) {
        console.debug(`WC EVENT: connect : ${userId}`);

        // replace connection with same URL
        let count = await database.calcWalletConnect(userId);
        let sameFlag = false;
        const oldConnect = await database.getWalletConnect(
            {user_id: userId, url: session.peerMeta.url});
        if (oldConnect) {
            if (oldConnect.peer_id !== session.peerId) {
                //
            } else {
                sameFlag = true;
            }
        }

        // delete one connection to keep not more than maxSessions
        const maxSessions = 5;

        if (count >= maxSessions && !sameFlag) {

            const oldConnect = await database.getWalletConnect({user_id: userId});
            if (oldConnect) {
                const oldConn = getConnector(userId, oldConnect.peer_id);
                if (oldConn) {
                    oldConn.disconnect();
                }
            }
        }

        saveConnectSession(userId, session.peerId);

        const dbObj = {
            session,
            user_id: userId,
            url: session.peerMeta.url,
            peer_id: session.peerId,
            date: new Date(),
            key: session.key
        }
        await database.insertWalletConnect(dbObj);

        if (!sameFlag) {
            this.emit('wcConnected', {user_id: userId, peer_id: session.peerId});
        }
    }

    async wcSwitchChain(params, connector) {
        const node = await blockchain.getChainById(params.chainId);

        if (!node) {
            const msgText = `Unsupported chain [${params.chainId}]`;
            connector.rejectRequest(params.rqId, msgText);
            throw new Error(msgText);
        } else {
            await connector.approveRequest(params.rqId, 'ok');

            await connector.setChainId(params.chainId);
            const session = connector.session();

            const msgObj = {
                name: session.peerMeta.name,
                url: session.peerMeta.url,
                net: node['networkName']
            }
            await this.wcConnected(params.userId, session);
            this.emit('wcSwitchChain', {user_id: params.userId, peer_id: params.peerId});
        }
    }

    async wcEthSign(params, connector) {
        const check =  await checkTransactionUser(params, connector);

        let sendObj = {
            nodeName: check.node.name,
            rq_id: params.rqId,
            peer_id: params.peerId,
            user: check.user,
            user_id: check.user.user_id,
            type: 'sign message'
        }

        if ('message' in params) {
            sendObj.message = params.message;
        } else {
            sendObj.typedData = params.typedData;
        }

        sendObj = {
            ...sendObj,
            ...parseRequestParams(connector, sendObj)
        }

        this.emit('wcSign', sendObj);
    }

    async wcSendTransaction(params, connector) {
        const check =  await checkTransactionUser(params, connector);

        let sendObj = {
            nodeName: check.node.name,
            txConfig: (Object.prototype.toString.call(params.params) === '[object Array]')
                ? params.params[0]
                : params.params.transaction
                    ? params.params.transaction
                    : params.params,
            peer_id: params.peerId,
            rq_id: params.rqId,
            user: check.user,
            user_id: check.user.user_id,
            signOnly: params.signOnly,
            type: params.signOnly ? 'sign transaction' : 'send transaction'
        }

        sendObj = {
            ...sendObj,
            ...parseRequestParams(connector, sendObj)
        }

        this.emit('wcSign', sendObj);
    }

    async wcDisconnected(params, connect) {
        if (!params.peerId) return;

        const connector = connect ? connect : await getConnector(params.userId, params.peerId);

        let session;
        let msg = {user_id: params.userId, peer_id: params.peerId};
        const peerId = params.peerId;
        const localPeerId = peerId.length < 60 ? peerId : peerId.substring(peerId.length-32);

        if (connector) {
            session = connector.session(localPeerId);

            if (!session) return;

            msg.url = session.peerMeta.url;
            msg.dApp = session.peerMeta.name;
        }

        this.emit('wcDisconnected', msg);

        const connMap = wconnectMap.get(params.userId);
        if (connMap) {
            connMap.delete(localPeerId);
        }

        await database.deleteWalletConnect(peerId);
    }
}

async function checkTransactionUser(params, connector) {
    let chainId = params.chainId;

    const node = await blockchain.getChainById(chainId);

    if (!node) {
        await connector.rejectRequest(params.rqId, 'Unsupported Chain', params.peerId);
        return;
    }

    return {connector, user: connector.getUser(), node};
}

function saveConnectSession(userId, peerId, connect) {
    console.log('saveConnectSession: ', userId, peerId);
    let connMap = wconnectMap.get(userId);
    if (!connMap) connMap = new Map();

    if (!peerId) {
        connMap.set(userId, connect);
    } else {

        const localPeerId = peerId.length < 60 ? peerId : peerId.substring(peerId.length-32);

        if (!connect) {
            const conn = connMap.get(userId);
            if (conn) {
                connMap.set(localPeerId, conn);
                connMap.delete(userId);
            }

        } else {
            connMap.set(localPeerId, connect);
        }
    }

    wconnectMap.set(userId, connMap);
}

async function initConnector(connect, userId, version = 1) {
    console.log('initConnector: ', userId, version);
    if (version === 1) {
        connect.on('wcError', eventsHandler.wcError);
        connect.on('wcConnected', eventsHandler.wcConnected);
        connect.on('wcSwitchChain', eventsHandler.wcSwitchChain);
        connect.on('wcDisconnected', eventsHandler.wcDisconnected);
        connect.on('wcSendTransaction', eventsHandler.wcSendTransaction);
        connect.on('wcEthSign', eventsHandler.wcEthSign);
        try {
            await connect.connect();
            console.log(connect.session());
            saveConnectSession(userId, connect.session().peerId, connect);
            // eventsHandler.emit('wcConnected', {user_id: userId, peer_id: connect.session().peerId});
        } catch (e) {
            console.warn(e.toString());
        }
    } else {
        connect.on('wcSessionProposal', eventsHandler.wcSessionProposal);
        connect.on('wcSessionPing', eventsHandler.wcSessionPing);
        connect.on('wcDisconnected', eventsHandler.wcDisconnected);
        connect.on('wcEthSign', eventsHandler.wcEthSign);
        connect.on('wcSendTransaction', eventsHandler.wcSendTransaction);
        saveConnectSession(userId, `0_${userId}`, connect);
    }
}

async function clearWC2db (idList) {

    fs.readdirSync(wc2LocalPath).forEach(function(file) {

        let fl = `${wc2LocalPath}/${file}`;
        const stat = fs.statSync(fl);

        if (stat && stat.isFile()) {
            if (!idList.has(file)) {
                fs.unlinkSync(fl);
            }
        }

    });
}


/**
 * @typedef WalletConnectMeta
 * @property {string} description - client description
 * @property {string} url - client URL
 * @property {array<string>} icons - array of Icon urls
 * @property {string} name - client name
 */

/**
 * Initialize wallet connect client
 * Recover and activate previous sessions
 * For node.js WalletConnect 2.0 saves sessions in local files using lokijs
 * @param {object} blockChainObject object returned by abwSDK.initBlockchain
 * @param {object} databaseObject object returned by abwDB.init
 * @param {WalletConnectMeta} meta client meta information
 * @returns {Promise<undefined>} blockchain object if needed direct access to it's functions
 */
async function initialize(blockChainObject, databaseObject, meta) {
    database = databaseObject;
    clientMeta = meta;
    blockchain = blockChainObject;

    eventsHandler = new WcEventsHandler();

    isPathExists(`${wc2LocalPath}/1.db`);

    const idList = new Set();

    const connects = await database.getWalletConnects();
    for (let connect of connects) {

        let conn;
        const userId = connect.user_id;

        if (connect.version === 2) {

            idList.add(`wc${userId}.db`);
            conn = getConnector(userId);

            if (!conn) {
                const user = await database.getUser(userId);
                conn = new WConnector2(user, wc2LocalPath, clientMeta);
                await conn.init();
                await initConnector(conn, userId, connect.version);
            }

            conn.setSession(connect.session);
            saveConnectSession(userId, connect.peer_id, conn);

        } else {
            const user = await database.getUser(userId);
            conn = new WConnector(connect.session, null, user,
                connect.session.accounts[0], connect.session.chainId, clientMeta);
            await initConnector(conn, userId, connect.version);

        }
    }

    clearWC2db(idList).then();
}

/** helper functions */
function getConnector(userId, peerId) {

    console.log('getConnector: ', userId, peerId);

    const connMap = wconnectMap.get(userId);

    if (!connMap) {
        return;
    }

    let localPeerId;
    let connector;

    if (peerId) {

        localPeerId = peerId.length < 60 ? peerId : peerId.substring(peerId.length - 32);
        connector = connMap.get(localPeerId);

    } else {

        for (let con of connMap.values()) {
            if (con.version() === 2) {
                connector = con;
                break;
            }
        }
    }

    if (!connector) {
        console.warn(`No connector [user: ${userId}] [peer: ${peerId}]`);
        return;
    }

    return connector;
}

function parseRequestParams(connector, sendObj) {
    let params;
    if ('message' in sendObj) {
        let msg;
        if (sendObj.message.substring(0, 2) === '0x') {
            const buf = Buffer.from(sendObj.message.substring(2), 'hex');
            // console.log(buf);
            msg = buf.toString('utf8');
        } else {
            msg = sendObj.message;
        }
        // console.log(msg);
        params = {
            message: msg
        }
    } else if ('typedData' in sendObj) {
        // const obj = JSON.parse(sendObj.message);
        params = {
            message: JSON.parse(sendObj.typedData)
        }
    } else {
        params = {
            ...sendObj.txConfig
        }
    }

    delete params.data;

    return  {
        dapp: connector.session(sendObj.peer_id).peerMeta.name,
        network: sendObj.nodeName,
        params: JSON.stringify(params, null, ' '),
        version: connector.version()
    }
}

/**
 * Get info about specific connection
 * @param {string|number} userId user_id as it stored in DB
 * @param {string} peerId peer_id as in returned after connect was created
 * @returns {Promise<object>} JSON object
 */
async function getConnectInfo(userId, peerId) {
    let localPeerId;

    const connMap = wconnectMap.get(userId);

    if (connMap) {
        let connectors = [...connMap.values()];
        let peers = [...connMap.keys()];

        let str = `0_${userId}`;
        let p = [];
        let c = [];

        for (let j = 0; j < connectors.length; j++) {
            const pr = peers[j];
            if (pr !== str) {
                p.push(peers[j]);
                c.push(connectors[j]);
            }
        }

        connectors = c;
        peers = p;

        let i = 0;
        if (peerId) {
            localPeerId = peerId.length < 60 ? peerId : peerId.substring(peerId.length-32);
            for (let x = 0; x < connectors.length; x++) {
                if (peers[x] === localPeerId) {
                    i = x;
                    break;
                }
            }
        } else {
            i = 0;
        }

        if (!connectors.length) {
            return;
        }

        const connector = connectors[i];
        let connInfo = {};

        if (connector.connected()) {
            localPeerId = peers[i];

            const session = connector.session(localPeerId);

            connInfo.version = `${connector.version()}.0`;
            connInfo.dapp = session.peerMeta.name;
            connInfo.dappLink = session.peerMeta.url;
            connInfo.chainId = session.chainId;

            return connInfo;
        } else {
            if (connMap) {
                connMap.delete(localPeerId);
            }
        }
    }
}


/** user actions */

/**
 * Approve request received from dApp
 * For sign requests - message/transaction will be signed and sent back to dApp
 * For Send requests (actual for EVM-based chains) - transaction will be signed and sent directly to Blockchain
 * @param {object} params params as they were received from WC Request Event: wcSign
 * @param {string} key private key to sign
 * @returns {Promise<object>} object contains result, message and data - otherwise error is thrown
 */
async function approveRequest (params, key) {
    const connector = getConnector(params.user_id, params.peer_id);
    if (!connector) return;

    const session = connector.session(params.peer_id);

    if ('txConfig' in params) { // sign message
        if (params.signOnly) {
            try {
                const tx = await blockchain.signExtTransaction(params, key);
                connector.approveRequest(params.rq_id, tx.rawTransaction || tx, session.peerId);
                // NOTE emit success or return it
                return {result: 'ok', message: 'TX signed', data: tx.rawTransaction};
            } catch (e) {
                const msgText = 'Sign Transaction error';
                console.error(`WC2 sign TX error: ${e}`);
                connector.rejectRequest(params.rq_id, msgText, session.peerId);
                throw new Error(`WC2 sign TX error: ${e}`);
            }
        } else {
            try {
                const res = await blockchain.sendExtTransaction(params, key);
                if (res) {
                    connector.approveRequest(params.rq_id, res, session.peerId);
                    return {result: 'ok', message: 'TX sent', data: res};
                } else {
                    const msgText = 'Transaction error';
                    connector.rejectRequest(params.rq_id, msgText, session.peerId);
                    console.error(`WC2 send TX error`);
                    throw new Error(`WC send TX error`);
                }
            } catch (e) {
                const msgText = 'Transaction error';
                connector.rejectRequest(params.rq_id, msgText, session.peerId);
                console.error(`WC2 send TX error: ${e}`);
                throw new Error(`WC send TX error`);
            }
        }
    } else {
        const res = ('message' in params)
            ? await blockchain.signExtMessage(params, key)
            : await blockchain.signExtTypedData(params, key);
        if (res) {
            connector.approveRequest(params.rq_id, res, session.peerId);
            return {result: 'ok', message: 'Message signed', data: res};
        } else {
            const msgText = 'Sign message error';
            connector.rejectRequest(params.rq_id, msgText, session.peerId);
            throw new Error(msgText);
        }
    }
}

/**
 * Reject request received from dApp
 * @param {string|number} user_id as it stored in DB
 * @param {string} peer_id session ID
 * @param {chain_id} rq_id request ID
 * @returns {Promise<undefined>}
 */
async function rejectRequest (user_id, peer_id, rq_id) {
    const connector = getConnector(user_id, peer_id);
    if (!connector) return;

    const session = connector.session(peer_id);

    connector.rejectRequest(rq_id, null, session.peerId);
}

/**
 * Call dApp to switch active chain
 * Not needed for WC2.0
 * @param {string|number} user_id as it stored in DB
 * @param {string} peer_id session ID
 * @param {chain_id} chain_id new chain ID
 * @returns {Promise<undefined>}
 */
async function switchChain (user_id, peer_id, chain_id) {
    const connector = getConnector(user_id, peer_id);
    if (!connector) return;

    await connector.setChainId(chain_id);
    const session = connector.session();

    await eventsHandler.wcConnected(user_id, session);
}

/**
 * Disconnect one walletconnect session
 * @param {string|number} user_id as it stored in DB
 * @param {string} peer_id session ID
 * @returns {Promise<undefined>}
 */
async function disconnect (user_id, peer_id) {
    const connector = getConnector(user_id, peer_id);
    if (!connector) {
        return;
    }

    const session = connector.session(peer_id);

    try {
        await connector.disconnect(session.peerId);
    } catch (e) {
        console.error(e);
        throw new Error(e);
    }

    if (connector.version() === 2) {
        const params = {
            userId: user_id,
            peerId: session.peerId,
            rqId: 0
        }
        await eventsHandler.wcDisconnected(params, connector);
    }
}

/**
 * Initialize WC connection (pair) with provided connection string
 * @param {object} user JSON user representation (should have user_id and wallet fields)
 * @param {string} connectString connection string provided by dApp (v1 or v2)
 * @param {number} [chainId=1] chain ID -initial chain needed for v1 connection
 * @returns {Promise<object>} connection info
 */
async function createConnection (user, connectString,  chainId = 1) {
    const { version } = parseUri(connectString);

    if (isNaN(version)) {
        throw new Error('Wrong connection string was provided');
    }

    let connector;

    const userId = user.user_id;

    try {
        if (version === 1) {

            let address;

            if (user.wallet) {
                if (user.wallet.ether) {
                    if (user.wallet.ether.address) {
                        address = user.wallet.ether.address;
                    }
                }
            }

            if (!address) return;

            connector = new WConnector(null, connectString, user, address, chainId, clientMeta);
        } else {
            connector = getConnector(userId);
            if (!connector) {
                connector = new WConnector2(user, wc2LocalPath, clientMeta);
                await connector.init();
                await initConnector(connector, userId, version);
            }
        }

        const checkWc = await database.getWalletConnect({key: connector.key});

        if (!checkWc) {
            if (version === 2) {
                await connector.pair(connectString);
            } else {
                await initConnector(connector, userId, version);
            }
        } else {
            return getConnectInfo(userId, checkWc.peerId);
        }

    } catch (e) {
        console.warn(e.toString());
        throw new Error(e);
    }
}

/**
 * Get handler object to catch WC events
 * @returns {object} events handler object
 */
function getEventsHandler() {
    return eventsHandler;
}

module.exports = {
    initialize, createConnection, getConnectInfo, getEventsHandler, disconnect, switchChain,
    rejectRequest, approveRequest
}