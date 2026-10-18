/*
 * The text that "Copy diagnostics" puts on the clipboard, for a bug report. It is a report for the developer, not
 * panel text, so it is English and not in lang/en.json. It holds no secret and no personal data: no bot token, no
 * Discord ids, and no names, only versions, states, and counts.
 */

/**
 * @typedef {object} DiagnosticsInput
 * @property {Date} time
 * @property {string} moduleVersion
 * @property {string} foundryVersion
 * @property {string} systemId
 * @property {string} hostname  location.hostname of the Foundry page.
 * @property {number} protocolVersion  The protocol version of the module.
 * @property {import("../bridge/bridge-link.mjs").BridgeFacts} facts
 * @property {import("../bridge/connection-status.mjs").ConnectionStatus} status
 * @property {number} linkedUserCount
 * @property {number} userCount
 * @property {import("../bridge/status-history.mjs").StatusEntry[]} history
 */

/** @param {DiagnosticsInput} input */
export function buildDiagnostics(input) {
  const { facts, status } = input;
  return [
    "Talking Tokens diagnostics",
    `Time: ${input.time.toISOString()}`,
    `Module: ${input.moduleVersion} (protocol ${input.protocolVersion})`,
    `Foundry: ${input.foundryVersion}, system ${input.systemId}`,
    `Page host: ${input.hostname}`,
    `Bridge: ${facts.bridgeVersion ?? "unknown"}, link ${facts.linkState}, compatible ${facts.isCompatible}`,
    `Status: ${describe(status)}`,
    `Bot logged in: ${Boolean(facts.status?.botTag)}`,
    `Voice members visible: ${facts.voiceMembers.length}`,
    `Users linked to Discord: ${input.linkedUserCount} of ${input.userCount}`,
    `Last token result: ${describeTokenResult(facts.tokenResult)}`,
    "",
    "Status changes (oldest first):",
    ...input.history.map((entry) => `${entry.time.toISOString()}  ${describe(entry)}`),
  ].join("\n");
}

function describe({ state, channelName }) {
  return channelName ? `${state} (#${channelName})` : state;
}

function describeTokenResult(result) {
  if (!result) return "none";
  return result.accepted ? "accepted" : `refused: ${result.error}`;
}
