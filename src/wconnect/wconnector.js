const EventEmitter = require('events')
const WalletConnect = require('@walletconnect/client');

const defaultChainId = 1;

class WConnector extends EventEmitter {
    constructor(session, uri, user, account, chainId, clientMeta) {
        super();

        this.setRpc = this.setRpc.bind(this);
        this.setChainId = this.setChainId.bind(this);
        this.disconnect = this.disconnect.bind(this);

        this.userId = user.user_id;
        this.user = user;
        this.account = account;
        this.chainId = chainId || defaultChainId;

        if (session) {
            this.connector = new WalletConnect.default({session});
            this.peerId = session.peerId;
        } else {
            this.connector = new WalletConnect.default({
                uri: uri,
                clientMeta: clientMeta
            });
        }

        this.key = this.connector.key;

        this.connector.on('session_request', (error, payload) => {
            console.log('EVENT', 'session_request');

            if (error) {
                this.emit('wcError', this.userId, 'session request error', error);
            }

            let chainId = this.chainId;
            if (payload.params) {
                if (payload.params[0]) {
                    chainId = payload.params[0].chainId || this.chainId;
                    this.chainId = chainId;
                }
            }

            // console.log(this.chainId);

            this.connector.approveSession({
                accounts: [this.account],
                chainId: chainId,
                // rpcUrl: defaultRpc
            });
            // console.log(JSON.stringify(payload, null, ' '));
        });

        this.connector.on('connect', (error) => {
            console.log('EVENT', 'connect');

            if (error) {
                this.emit('wcError', this.userId, 'connection error', error);
            }
            // console.log(this.connector.session);
            // console.log(this.chainId);

            this.peerId = this.connector.session.peerId;
            this.emit('wcConnected', this.userId, this.connector.session);

            // console.log(JSON.stringify(payload, null, ' '));
        });

        this.connector.on('session_update', (error) => { // , payload
            console.log('EVENT', 'session_update');//, payload);

            if (error) {
                this.emit('wcError', this.userId, 'CALL request error', error);
            }

            // this.peerId = this.connector.session.peerId;
            // console.log(JSON.stringify(payload, null, ' '));
        });

        this.connector.on('call_request', (error, payload) => {
            console.log('EVENT', 'call_request', payload);

            if (error) {
                this.emit('wcError', this.userId, 'CALL request error', error);
            }

            switch (payload.method) {
                case 'wallet_switchEthereumChain': {
                    const chainId = Number(payload.params[0].chainId);
                    const params = {
                        userId: this.userId,
                        peerId: this.peerId,
                        chainId,
                        rqId: payload.id
                    }
                    // this.approveRequest(payload.id, 'ok');
                    this.emit('wcSwitchChain', params, this);
                    break;
                }
                case 'personal_sign': {
                    const params = {
                        userId: this.userId,
                        peerId: this.peerId,
                        chainId: this.chainId,
                        message: payload.params[0],
                        rqId: payload.id
                    }
                    this.emit('wcEthSign', params, this);
                    break;
                }
                case 'eth_sign': {
                    const params = {
                        userId: this.userId,
                        peerId: this.peerId,
                        chainId: this.chainId,
                        message: payload.params[1],
                        rqId: payload.id
                    }
                    this.emit('wcEthSign', params, this);
                    break;
                }
                case 'eth_signTypedData': {
                    const params = {
                        userId: this.userId,
                        peerId: this.peerId,
                        chainId: this.chainId,
                        typedData: payload.params[1],
                        rqId: payload.id
                    }
                    this.emit('wcEthSign', params, this);
                    break;
                }
                case 'eth_signTransaction': {
                    const params = {
                        userId: this.userId,
                        peerId: this.peerId,
                        chainId: this.chainId,
                        typedData: payload.params[1],
                        rqId: payload.id,
                        signOnly: true
                    }
                    this.emit('wcEthSign', params, this);
                    break;
                }
                case 'eth_sendRawTransaction': {
                    //
                    break;
                }
                case 'eth_sendTransaction': {
                    const params = {
                        userId: this.userId,
                        peerId: this.peerId,
                        chainId: this.chainId,
                        params: payload.params,
                        rqId: payload.id
                    }
                    this.emit('wcSendTransaction', params, this);
                    break;
                }
                default: {
                    this.emit('wcRequest', this.userId, payload);
                }
            }
        });

        this.connector.on('disconnect', async (error) => {
            console.log('EVENT', 'disconnect');

            if (error) {
                this.emit('wcError', this.userId, 'disconnect error', error);
            }

            // Delete connector
            try {
                const params = {
                    userId: this.userId,
                    peerId: this.peerId
                }
                this.emit('wcDisconnected', params, this);
            } catch (e) {
                this.emit('wcError', this.userId, '', error);
            }
        });
    }

    version() {
        return 1;
    }

    getUser() {
        return this.user;
    }

    connected() {
        return this.connector.connected;
    }

    session() {
        return this.connector.session;
    }

    async connect() {
        console.log('Connecting WC1');
        if (!this.connector.connected) {
            console.log('createSession WC1');
            try {
                await this.connector.createSession();
            } catch (e) {
                console.error(e);
            }
        }
    }

    async disconnect() {
        // console.log('disconnect', this.peerId);
        try {
            await this.connector.killSession();
        } catch (e) {
            this.emit('wcError', 0, '', e.toString());
        }
    }

    rejectRequest(id, message) {
        this.connector.rejectRequest({
            id: id,                                  // required
            error: {
                code: "404",           // optional
                message: message     // optional
            }
        });
    }

    approveRequest(id, message) {
        console.log(id, message);
        this.connector.approveRequest({
            id: id,
            // jsonrpc: '2.0',
            result: message
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
    WConnector
};