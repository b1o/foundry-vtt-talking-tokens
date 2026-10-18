import { connect } from "node:net";
import WebSocket from "ws";
import { BRIDGE_MESSAGE, bridgeUrl, parseBridgeMessage } from "../../../module/scripts/protocol.mjs";

export const EXISTING_BRIDGE = Object.freeze({
  NONE: "none",
  RUNNING: "running",
  UNRESPONSIVE: "unresponsive",
});

const LOOPBACK_HOST = "127.0.0.1";

/** A healthy bridge sends hello at once; a hung one does not finish the handshake. */
const ANSWER_TIMEOUT_MS = 3_000;

/**
 * Is a bridge already on the port, and does it answer?
 * Two steps, because the WebSocket errors cannot tell a free port from a broken program: under Bun, the ws package
 * is Bun's own WebSocket, and its errors have no code. A plain TCP connection reports ECONNREFUSED in Node and Bun.
 * @param {number} port
 * @returns {Promise<string>} A value of EXISTING_BRIDGE.
 */
export async function probeExistingBridge(port) {
  if (!(await isPortInUse(port))) return EXISTING_BRIDGE.NONE;
  return (await receivesHello(port)) ? EXISTING_BRIDGE.RUNNING : EXISTING_BRIDGE.UNRESPONSIVE;
}

function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, LOOPBACK_HOST);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
  });
}

function receivesHello(port) {
  return new Promise((resolve) => {
    // The bridge accepts only loopback origins, as the Foundry page on localhost sends them.
    const socket = new WebSocket(bridgeUrl(port), { origin: "http://localhost" });
    const finish = (received) => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.on("error", () => undefined); // terminate() can still report an error for the socket that we close.
      socket.terminate();
      resolve(received);
    };
    const timer = setTimeout(() => finish(false), ANSWER_TIMEOUT_MS);
    socket.on("message", (data) => {
      if (parseBridgeMessage(String(data)).message?.type === BRIDGE_MESSAGE.HELLO) finish(true);
    });
    // Any failure after the TCP connect worked means that the program on the port does not act as a bridge.
    socket.on("error", () => finish(false));
  });
}
