class TwitchPubSub extends EventTarget {
    WSURL = "wss://pubsub-edge.twitch.tv";

    _blackout = 1000;
    _pingPong = 0;
    _ponged = false;

    constructor(twtchId = null, twitchName = null) {
        super();

        if (!twtchId && !twitchName) throw new Error("No channel data provided.");

        this._blackout = 1000;
        this._pingPong = 0;

        this._twitchId = twtchId;
        this._twitchName = twitchName;

        this._ws = new ReconnectingWebSocket(this.WSURL);

        this._ws.onopen = this.onOpen.bind(this);
        this._ws.onmessage = this.onMessage.bind(this);
    }

    async onOpen() {
        this._blackout = 1000;

        this._pingPong = setInterval(() => {
            this._ws.send(JSON.stringify({
                "type": "PING"
            }));

            setTimeout(() => {
                if (!this._ponged) this._ws.reconnect();
                else this._ponged = false;
            }, 10000)
        }, 300000 + (Math.random() * 1000));

        if (!this._twitchId) {
            const data = await fetch("https://gql.twitch.tv/gql", {
                method: "POST",
                headers: {
                    "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                    "Client-Session-Id": "82cd986668016acf",
                    "Client-Version": "230efef6-cd6b-4735-af9c-315679f70402"
                },
                body: JSON.stringify([
                    {
                        operationName: 'GetUserID',
                        variables: { login: this._twitchName, lookupType: 'ACTIVE' },
                        extensions: {
                            persistedQuery: {
                                version: 1,
                                sha256Hash: 'bf6c594605caa0c63522f690156aa04bd434870bf963deb76668c381d16fcaa5'
                            }
                        }
                    }
                ])
            }).then(r => r.json());
            this._twitchId = data[0].data.user.id;
        }

        this._ws.send(JSON.stringify({
            "type": "LISTEN",
            "nonce": "notcare",
            "data": {
                "topics": [`community-points-channel-v1.${this._twitchId}`],
            }
        }));

        console.log("[DEBUG] Connected!");
    }

    onMessage(pkg) {
        this._handleMessage(JSON.parse(pkg.data));
    }

    _handleMessage(pkg) {
        if (pkg.type == "PONG") {
            this._ponged = true;
            return;
        }

        if (pkg.type == "MESSAGE") {
            const message = JSON.parse(pkg.data.message);

            this.dispatchEvent(new PubSubMessageEvent(message.type, message.data));
        }

        if (pkg.type == "RECONNECT") {
            this.reset();
        }
    }
}

class PubSubMessageEvent extends Event {
    constructor(type, data) {
        super(type);
        this.data = data;
    }
}
