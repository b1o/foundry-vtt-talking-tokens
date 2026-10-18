import { BRIDGE_STATE } from "../protocol.mjs";
import { LINK_STATE } from "./bridge-client.mjs";

/** The states that only the module knows, plus every state of the bridge. */
export const PANEL_STATE = Object.freeze({
  NOT_LOCALHOST: "not-localhost",
  CONNECTING: "connecting",
  BRIDGE_NOT_FOUND: "bridge-not-found",
  INCOMPATIBLE: "incompatible",
  ...BRIDGE_STATE,
});

export const TONE = Object.freeze({ OK: "ok", WAITING: "waiting", ERROR: "error" });

/**
 * The buttons next to the status: only the Discord session, which the GM uses in every game. Setup steps (download,
 * token, invite, "Who are you?", help links) live once in the Setup section of the panel.
 */
export const SESSION_ACTION = Object.freeze({
  CONNECT: "connect",
  DISCONNECT: "disconnect",
});

const PRESENTATION = {
  [PANEL_STATE.NOT_LOCALHOST]: { tone: TONE.ERROR, sessionAction: null },
  [PANEL_STATE.CONNECTING]: { tone: TONE.WAITING, sessionAction: null },
  [PANEL_STATE.BRIDGE_NOT_FOUND]: { tone: TONE.ERROR, sessionAction: null },
  [PANEL_STATE.INCOMPATIBLE]: { tone: TONE.ERROR, sessionAction: null },
  [PANEL_STATE.NO_TOKEN]: { tone: TONE.WAITING, sessionAction: null },
  [PANEL_STATE.IDLE]: { tone: TONE.ERROR, sessionAction: SESSION_ACTION.CONNECT },
  [PANEL_STATE.LOGGING_IN]: { tone: TONE.WAITING, sessionAction: null },
  [PANEL_STATE.TOKEN_REJECTED]: { tone: TONE.ERROR, sessionAction: null },
  [PANEL_STATE.DISCORD_UNREACHABLE]: { tone: TONE.ERROR, sessionAction: SESSION_ACTION.CONNECT },
  [PANEL_STATE.NO_SERVER]: { tone: TONE.ERROR, sessionAction: SESSION_ACTION.DISCONNECT },
  [PANEL_STATE.NO_GM]: { tone: TONE.WAITING, sessionAction: SESSION_ACTION.DISCONNECT },
  [PANEL_STATE.GM_NOT_IN_VOICE]: { tone: TONE.WAITING, sessionAction: SESSION_ACTION.DISCONNECT },
  [PANEL_STATE.MISSING_PERMISSION]: { tone: TONE.ERROR, sessionAction: SESSION_ACTION.DISCONNECT },
  [PANEL_STATE.JOINING]: { tone: TONE.WAITING, sessionAction: SESSION_ACTION.DISCONNECT },
  [PANEL_STATE.LISTENING]: { tone: TONE.OK, sessionAction: SESSION_ACTION.DISCONNECT },
  [PANEL_STATE.RECONNECTING]: { tone: TONE.WAITING, sessionAction: SESSION_ACTION.DISCONNECT },
};

/**
 * @typedef {object} ConnectionStatus
 * @property {string} state  A value of PANEL_STATE.
 * @property {string} tone   A value of TONE.
 * @property {string|null} sessionAction  A value of SESSION_ACTION: the button next to the status, if any.
 * @property {string|null} channelName
 * @property {string|null} inviteUrl
 * @property {{channel: string|null, bridge: string, module: string}} textData  The values for the status text.
 */

/**
 * @param {import("./bridge-link.mjs").BridgeFacts} facts
 * @param {{isLocalhost: boolean, moduleVersion: string}} page  isLocalhost: was this Foundry page opened through
 *   localhost?
 * @returns {ConnectionStatus}
 */
export function describeConnection(facts, { isLocalhost, moduleVersion }) {
  const state = panelState(facts, isLocalhost);
  const channelName = facts.status?.channelName ?? null;
  return {
    state,
    ...PRESENTATION[state],
    channelName,
    inviteUrl: facts.status?.inviteUrl ?? null,
    textData: { channel: channelName, bridge: facts.bridgeVersion ?? "?", module: moduleVersion },
  };
}

function panelState(facts, isLocalhost) {
  if (!isLocalhost) return PANEL_STATE.NOT_LOCALHOST;
  if (facts.linkState === LINK_STATE.UNREACHABLE) return PANEL_STATE.BRIDGE_NOT_FOUND;
  if (facts.linkState !== LINK_STATE.OPEN) return PANEL_STATE.CONNECTING;
  // Checked before the status, because the status of an incompatible bridge can fail the validation.
  if (!facts.isCompatible) return PANEL_STATE.INCOMPATIBLE;
  return facts.status?.state ?? PANEL_STATE.CONNECTING;
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The bridge accepts only loopback origins, and browsers block a non-local page from reaching 127.0.0.1.
 * @param {string} hostname  location.hostname of the Foundry page.
 */
export function isLoopbackHostname(hostname) {
  return LOOPBACK_HOSTNAMES.has(hostname);
}
