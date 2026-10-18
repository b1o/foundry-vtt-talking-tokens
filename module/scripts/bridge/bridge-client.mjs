import { log } from "../output.mjs";
import { parseBridgeMessage } from "../protocol.mjs";

export const LINK_STATE = Object.freeze({
  STOPPED: "stopped",
  CONNECTING: "connecting",
  OPEN: "open",
  UNREACHABLE: "unreachable",
});

/** Wait times between reconnect attempts. The last one repeats. */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000];

/**
 * @typedef {object} ClientEvents
 * @property {(message: object) => void} onMessage  Only valid messages arrive here.
 * @property {(linkState: string) => void} onLinkChange
 * @property {(error: string) => void} onInvalidMessage
 *
 * @typedef {{setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout}} Timers
 */

/** The WebSocket to the bridge. It reconnects until stop(), because the GM can start the bridge at any time. */
export class BridgeClient {
  #url;
  #createWebSocket;
  #timers;
  #events;
  #socket = null;
  #reconnectTimer = null;
  #attempt = 0;
  #linkState = LINK_STATE.STOPPED;

  /**
   * @param {{url: string, createWebSocket: (url: string) => WebSocket, timers: Timers, events: ClientEvents}} options
   */
  constructor({ url, createWebSocket, timers, events }) {
    this.#url = url;
    this.#createWebSocket = createWebSocket;
    this.#timers = timers;
    this.#events = events;
  }

  get linkState() {
    return this.#linkState;
  }

  start() {
    if (this.#linkState !== LINK_STATE.STOPPED) return;
    this.#setLinkState(LINK_STATE.CONNECTING);
    this.#open();
  }

  stop() {
    this.#timers.clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
    const socket = this.#socket;
    this.#socket = null;
    socket?.close();
    this.#setLinkState(LINK_STATE.STOPPED);
  }

  /** @returns {boolean} False if the link is not open, so the message was not sent. */
  send(message) {
    if (this.#linkState !== LINK_STATE.OPEN) return false;
    this.#socket.send(JSON.stringify(message));
    return true;
  }

  #open() {
    const socket = this.#createWebSocket(this.#url);
    this.#socket = socket;
    const isCurrent = () => this.#socket === socket;
    socket.addEventListener("open", () => {
      if (!isCurrent()) return;
      this.#attempt = 0;
      this.#setLinkState(LINK_STATE.OPEN);
    });
    socket.addEventListener("message", (event) => isCurrent() && this.#onMessage(event.data));
    // A failed attempt fires "error" and then "close"; "close" alone is enough to schedule the next attempt.
    socket.addEventListener("close", () => isCurrent() && this.#scheduleReconnect());
  }

  #onMessage(text) {
    const { message, error } = parseBridgeMessage(text);
    if (error) this.#events.onInvalidMessage(error);
    else this.#events.onMessage(message);
  }

  #scheduleReconnect() {
    this.#socket = null;
    if (this.#linkState !== LINK_STATE.UNREACHABLE) {
      // Once per outage: the browser logs every failed retry by itself, and this line says where those lines come from.
      log.info(`The bridge does not answer on ${this.#url}. Retrying until it runs; `
        + `the browser logs each retry as "WebSocket connection to '${this.#url}' failed".`);
    }
    this.#setLinkState(LINK_STATE.UNREACHABLE);
    const delay = RECONNECT_DELAYS_MS[Math.min(this.#attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.#attempt += 1;
    this.#reconnectTimer = this.#timers.setTimeout(() => this.#open(), delay);
  }

  #setLinkState(linkState) {
    if (this.#linkState === linkState) return;
    this.#linkState = linkState;
    this.#events.onLinkChange(linkState);
  }
}
