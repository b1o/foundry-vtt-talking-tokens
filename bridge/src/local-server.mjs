import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { parseModuleMessage } from "../../module/scripts/protocol.mjs";

const LOOPBACK_HOST = "127.0.0.1";

export class PortInUseError extends Error {
  constructor(port, cause) {
    super(`Port ${port} is in use. Another bridge probably runs already. Close it, then start this one again.`, { cause });
  }
}

/**
 * @typedef {(message: object) => void} SendFunction
 *
 * @typedef {object} ServerEvents
 * @property {(send: SendFunction) => void} onClientConnected
 * @property {(message: object, reply: SendFunction) => void} onMessage  Only valid messages arrive here.
 * @property {(error: string) => void} onInvalidMessage
 * @property {(origin: string|undefined) => void} onRejectedOrigin
 */

/** The WebSocket endpoint for the Foundry module. It accepts connections only on the loopback interface. */
export class LocalServer {
  #port;
  #isOriginAllowed;
  #events;
  #httpServer = createServer((_request, response) => response.writeHead(426).end());
  #webSocketServer = new WebSocketServer({ noServer: true });

  /**
   * @param {{port: number, isOriginAllowed: (origin: string|undefined) => boolean, events: ServerEvents}} options
   */
  constructor({ port, isOriginAllowed, events }) {
    this.#port = port;
    this.#isOriginAllowed = isOriginAllowed;
    this.#events = events;
    this.#httpServer.on("upgrade", (request, socket, head) => this.#onUpgrade(request, socket, head));
    this.#webSocketServer.on("connection", (socket) => this.#onConnection(socket));
  }

  get port() {
    return this.#port;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.#httpServer.once("error", (error) => {
        reject(error.code === "EADDRINUSE" ? new PortInUseError(this.#port, error) : error);
      });
      this.#httpServer.listen(this.#port, LOOPBACK_HOST, resolve);
    });
  }

  broadcast(message) {
    const text = JSON.stringify(message);
    for (const socket of this.#webSocketServer.clients) socket.send(text);
  }

  close() {
    for (const socket of this.#webSocketServer.clients) socket.terminate();
    this.#httpServer.close();
  }

  #onUpgrade(request, socket, head) {
    const origin = request.headers.origin;
    if (!this.#isOriginAllowed(origin)) {
      this.#events.onRejectedOrigin(origin);
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    this.#webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      this.#webSocketServer.emit("connection", webSocket);
    });
  }

  #onConnection(socket) {
    const send = (message) => socket.send(JSON.stringify(message));
    socket.on("message", (data) => {
      const { message, error } = parseModuleMessage(data.toString());
      if (error) this.#events.onInvalidMessage(error);
      else this.#events.onMessage(message, send);
    });
    this.#events.onClientConnected(send);
  }
}
