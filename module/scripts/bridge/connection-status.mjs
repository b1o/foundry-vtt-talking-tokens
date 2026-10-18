import { BRIDGE_DOWNLOAD_URL, TROUBLESHOOTING_URL } from "../links.mjs";
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

export const ACTION = Object.freeze({
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  SETUP: "setup",
  INVITE: "invite",
  DOWNLOAD_BRIDGE: "download-bridge",
  EXPLAIN_LOCALHOST: "explain-localhost",
});

const PRESENTATION = {
  [PANEL_STATE.NOT_LOCALHOST]: { tone: TONE.ERROR, action: ACTION.EXPLAIN_LOCALHOST },
  [PANEL_STATE.CONNECTING]: { tone: TONE.WAITING, action: null },
  [PANEL_STATE.BRIDGE_NOT_FOUND]: { tone: TONE.ERROR, action: ACTION.DOWNLOAD_BRIDGE },
  [PANEL_STATE.INCOMPATIBLE]: { tone: TONE.ERROR, action: ACTION.DOWNLOAD_BRIDGE },
  [PANEL_STATE.NO_TOKEN]: { tone: TONE.WAITING, action: ACTION.SETUP },
  [PANEL_STATE.IDLE]: { tone: TONE.WAITING, action: ACTION.CONNECT },
  [PANEL_STATE.LOGGING_IN]: { tone: TONE.WAITING, action: null },
  [PANEL_STATE.TOKEN_REJECTED]: { tone: TONE.ERROR, action: ACTION.SETUP },
  [PANEL_STATE.DISCORD_UNREACHABLE]: { tone: TONE.ERROR, action: ACTION.CONNECT },
  [PANEL_STATE.NO_SERVER]: { tone: TONE.ERROR, action: ACTION.INVITE },
  [PANEL_STATE.NO_GM]: { tone: TONE.WAITING, action: ACTION.SETUP },
  [PANEL_STATE.GM_NOT_IN_VOICE]: { tone: TONE.WAITING, action: ACTION.DISCONNECT },
  [PANEL_STATE.MISSING_PERMISSION]: { tone: TONE.ERROR, action: ACTION.DISCONNECT },
  [PANEL_STATE.JOINING]: { tone: TONE.WAITING, action: ACTION.DISCONNECT },
  [PANEL_STATE.LISTENING]: { tone: TONE.OK, action: ACTION.DISCONNECT },
};

/**
 * @typedef {object} ConnectionStatus
 * @property {string} state  A value of PANEL_STATE.
 * @property {string} tone   A value of TONE.
 * @property {string|null} action  A value of ACTION: the one button that the status line offers.
 * @property {string|null} actionUrl  The web page that the action opens, if the action is a link.
 * @property {string|null} channelName
 * @property {string|null} inviteUrl
 */

/**
 * @param {import("./bridge-link.mjs").BridgeFacts} facts
 * @param {boolean} isLocalhost  Was this Foundry page opened through localhost?
 * @returns {ConnectionStatus}
 */
export function describeConnection(facts, isLocalhost) {
  const state = panelState(facts, isLocalhost);
  const { tone, action } = PRESENTATION[state];
  const inviteUrl = facts.status?.inviteUrl ?? null;
  return {
    state,
    tone,
    action,
    actionUrl: actionUrl(action, inviteUrl),
    channelName: facts.status?.channelName ?? null,
    inviteUrl,
  };
}

function actionUrl(action, inviteUrl) {
  switch (action) {
    case ACTION.INVITE: return inviteUrl;
    case ACTION.DOWNLOAD_BRIDGE: return BRIDGE_DOWNLOAD_URL;
    case ACTION.EXPLAIN_LOCALHOST: return TROUBLESHOOTING_URL;
    default: return null;
  }
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
