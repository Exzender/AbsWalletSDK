const EventEmitter = require('events')
const { SignClient } = require('@walletconnect/sign-client');
const { getSdkError } = require('@walletconnect/utils');
const { formatJsonRpcError, formatJsonRpcResult } = require('@walletconnect/jsonrpc-utils');

class WConnector2 extends EventEmitter {
    constructor(user, path, clientMeta) {
        super();

        this.setRpc = this.setRpc.bind(this);
        this.setChainId = this.setChainId.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.init = this.init.bind(this);
        this.activate = this.activate.bind(this);
        this.setSession = this.setSession.bind(this);
        this.session = this.session.bind(this);
        this.rejectSession = this.rejectSession.bind(this);

        this.userId = user.user_id;
        this.user = user;
        this.sessions = new Map();

        this.path = path;
        this.clientMeta = clientMeta;
    }

    async init() {
        console.log('Init WC2 object');

        const options = {
            name: `wc${this.userId}`,
            // logger: 'info',
            projectId: process.env.WC_PROJECT_ID,
            relayUrl: process.env.WC_RELAY_URL || 'wss://relay.walletconnect.com',
            metadata: this.clientMeta,
            storageOptions: {
                database: `${this.path}/wc${this.userId}.db`
            }};

        this.connector = await SignClient.init(options);
        console.log('Finished WC init');
        //
        // console.log('Pairings');
        // console.log(this.connector.core.pairing.getPairings());
        // console.log('Sessions');
        // console.log(this.connector.session.getAll());

        this.connector.on('session_proposal', async (event) => {
            // console.log(event.id);
            // console.log(JSON.stringify(event.params['requiredNamespaces'], null, ' '));
            // console.log(JSON.stringify(event));
            const params = {
                userId: this.userId,
                user: this.user,
                peerId: event.params['pairingTopic'],
                params: event.params,
                rqId: event.id
            }

            this.emit('wcSessionProposal', params, this);
        });

        this.connector.on('session_request', async (event) => {
            // console.log(event.id);
            // console.log(JSON.stringify(event), null, ' ');
            console.log(JSON.stringify(event.params['requiredNamespaces']));
            // console.log(JSON.stringify(event.params.relays));
            let chainId;
            const evParams = event.params;
            if (evParams.chainId.indexOf(':') !== -1) {
                let spl = evParams.chainId.split(':');
                chainId = spl[1];
            } else {
                chainId = evParams.chainId;
            }

            if (!isNaN(Number(chainId))) chainId = Number(chainId);
            // console.log('chainId: ', chainId);

            let params = {
                userId: this.userId,
                peerId: event.topic,
                // params: event.params,
                chainId,
                rqId: event.id,
                method: evParams.request.method
            }

            switch (evParams.request.method) {
                case 'personal_sign': {
                    params.message = evParams.request.params[0];
                    this.emit('wcEthSign', params, this);
                    break;
                }
                case 'tron_signMessage':
                case 'polkadot_signMessage':
                case 'solana_signMessage': {
                    params.message = evParams.request.params.message;
                    this.emit('wcEthSign', params, this);
                    break;
                }
                case 'eth_sign': {
                    params.message = evParams.request.params[1];
                    this.emit('wcEthSign', params, this);
                    break;
                }
                case 'eth_signTypedData': {
                    params.typedData = evParams.request.params[1];
                    this.emit('wcEthSign', params, this);
                    break;
                }
                case 'eth_sendTransaction': {
                    params.params = evParams.request.params;
                    this.emit('wcSendTransaction', params, this);
                    break;
                }
                case 'eth_signTransaction': {
                    params.params = evParams.request.params;
                    params.signOnly = true;
                    this.emit('wcSendTransaction', params, this);
                    break;
                }
                case 'tron_signTransaction':
                case 'polkadot_signTransaction':
                case 'solana_signTransaction': {
                    params.params = evParams.request.params;
                    params.signOnly = true;
                    this.emit('wcSendTransaction', params, this);
                    break;
                }
            }

        });

        this.connector.on('session_ping', async (event) => {
            const params = {
                userId: this.userId,
                peerId: event.topic,
                rqId: event.id
            }

            this.emit('wcSessionPing', params, this);
        });

        this.connector.on('session_delete', async (event) => {
            const params = {
                userId: this.userId,
                peerId: event.topic,
                rqId: event.id
            }

            this.emit('wcDisconnected', params, this);
        });
    }

    version() {
        return 2;
    }

    getUser() {
        return this.user;
    }

    async pair(uri) {
        console.log('pair: ', uri);
        return  this.connector.core.pairing.pair({ uri });
    }

    async activate() {
        console.log(`Activating: ${this.peerId}`);
    }

    async ping(eventId, topic) {
        console.log(`Ping: ${topic}`);
        await this.connector.core.pairing.ping({
            // id: eventId,
            topic
        });
    }

    async approveSession(eventId, namespaces) {
        const res = await this.connector.approve({
            id: eventId,
            namespaces
        });
        // console.log(res);
        await res.acknowledegd;
        return res.topic;
    }

    async rejectSession(id, string) {
        await this.connector.reject({
            id: id,
            proposerPublicKey: string,
            reason: getSdkError('USER_REJECTED_CHAINS')
        });
    }

    connected() {
        return true;
    }

    setSession(session) {
        const localPeerId = session.peerId.length < 60 ? session.peerId : session.peerId.substring(session.peerId.length-32);
        this.sessions.set(localPeerId, session);
    }

    session(peerId) {
        const localPeerId = peerId.length < 60 ? peerId : peerId.substring(peerId.length-32);
        return this.sessions.get(localPeerId);
    }

    async disconnect(peerId) {
        try {
            await this.connector.disconnect({topic: peerId, reason: 'Requested by User'});
        } catch (e) {
            this.emit('wcError', 0, '', e.toString());
        }
    }

    rejectRequest(id, message, topic) {
        const error = formatJsonRpcError(id, message || getSdkError('USER_REJECTED_METHODS').message);
        return  this.connector.respond({
            topic: topic,
            response: error,
        });
    }

    approveRequest(id, message, topic) {
        const msg = formatJsonRpcResult(id, message);

        return  this.connector.respond({
            topic: topic,
            response: msg,
        });
    }

    setRpc(rpcUrl) {
        this.connector.rpcUrl = rpcUrl;
    }

    async setChainId(chainId) {
        // console.log('setChainId', chainId);
        this.chainId = chainId;
        this.connector.updateSession({
            chainId: chainId,
            accounts: [this.account],
        });
    }

}

module.exports = {
    WConnector2
};