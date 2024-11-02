// websocket.js

class WebSocketClient {
    constructor({url, onMessageCallback, onOpenCallback=null, onCloseCallback=null, onErrorCallback=null}) {
        this.url = url;
        this.onMessageCallback = onMessageCallback;
        this.onOpenCallback = onOpenCallback;
        this.onCloseCallback = onCloseCallback;
        this.onErrorCallback = onErrorCallback;
        this.connect();
    }

    connect() {
        this.socket = new WebSocket(this.url);

        if (this.onOpenCallback) {
            this.socket.onopen = (event) => {
                this.onOpenCallback(event);
            };
        } else this.socket.onopen = () => {}

        this.socket.onmessage = (event) => {
            let data = JSON.parse(event.data);
            this.onMessageCallback(data);
        };

        if (this.onCloseCallback) {
            this.socket.onclose = (event) => {
                this.onCloseCallback(event);
                this.reconnect();
            };
        } else {this.socket.onclose = (event) => { this.reconnect(); }}


        if (this.onErrorCallback) {
            this.socket.onerror = (event) => {
                this.onErrorCallback(event);
           };            
        } else { this.socket.onerror = (event) => {}; }

    }

    reconnect() {
        console.log('Attempting to reconnect in 5 seconds...');
        setTimeout(() => {
            this.connect();
        }, 5000);
    }

    sendMessage(message) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }
}

export default WebSocketClient;
