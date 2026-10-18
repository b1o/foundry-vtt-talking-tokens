/*
 * A development stand-in for the Foundry module. It connects to a running bridge, prints every message, and can
 * send one command after the connection opens.
 *
 *   npm run test-client                      watch only
 *   npm run test-client -- connect           connect | disconnect
 *   npm run test-client -- set-gm <id>
 *   npm run test-client -- set-token         asks for the token, so it never appears in the shell history
 */
import { createInterface } from "node:readline/promises";
import WebSocket from "ws";
import { bridgeUrl, MODULE_MESSAGE, parseBridgeMessage } from "../../module/scripts/protocol.mjs";

async function buildCommand([name, argument]) {
  switch (name) {
    case undefined: return null;
    case "connect": return { type: MODULE_MESSAGE.CONNECT };
    case "disconnect": return { type: MODULE_MESSAGE.DISCONNECT };
    case "set-gm": return { type: MODULE_MESSAGE.SET_GM, discordId: argument };
    case "set-token": return { type: MODULE_MESSAGE.SET_TOKEN, token: await askForToken() };
    default: throw new Error(`Unknown command: ${name}`);
  }
}

async function askForToken() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const token = await prompt.question("Bot token: ");
  prompt.close();
  return token;
}

const command = await buildCommand(process.argv.slice(2));
// The bridge accepts only loopback origins, as a Foundry page on localhost sends them.
const socket = new WebSocket(bridgeUrl(), { origin: "http://localhost:30011" });

socket.on("open", () => {
  console.log("connected");
  if (command) socket.send(JSON.stringify(command));
});
socket.on("message", (data) => {
  const { message, error } = parseBridgeMessage(data.toString());
  console.log(error ? `INVALID: ${error}` : JSON.stringify(message));
});
socket.on("close", () => console.log("disconnected"));
socket.on("error", (error) => console.error(`ERROR: ${error.message}`));
