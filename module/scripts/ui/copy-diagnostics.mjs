import { MODULE_ID } from "../module-id.mjs";
import { log, notify } from "../output.mjs";
import { PROTOCOL_VERSION } from "../protocol.mjs";
import { buildDiagnostics } from "./diagnostics.mjs";

/**
 * Collect the Foundry facts for the diagnostics and copy the text to the clipboard.
 * @param {{facts: import("../bridge/bridge-link.mjs").BridgeFacts,
 *   status: import("../bridge/connection-status.mjs").ConnectionStatus,
 *   history: import("../bridge/status-history.mjs").StatusEntry[], mapping: Record<string, string>}} connection
 */
export async function copyDiagnostics({ facts, status, history, mapping }) {
  const text = buildDiagnostics({
    time: new Date(),
    moduleVersion: game.modules.get(MODULE_ID).version,
    foundryVersion: game.version,
    systemId: game.system.id,
    hostname: window.location.hostname,
    protocolVersion: PROTOCOL_VERSION,
    facts,
    status,
    linkedUserCount: game.users.filter((user) => mapping[user.id]).length,
    userCount: game.users.size,
    history,
  });
  try {
    await game.clipboard.copyPlainText(text);
    notify.info("TALKING_TOKENS.Notifications.DiagnosticsCopied");
  } catch (error) {
    notify.error("TALKING_TOKENS.Notifications.DiagnosticsFailed");
    log.error("The diagnostics could not be copied.", error);
  }
}
