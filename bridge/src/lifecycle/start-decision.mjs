import { EXISTING_BRIDGE } from "./existing-bridge.mjs";

export const START_DECISION = Object.freeze({
  START: "start",
  ALREADY_RUNNING: "already-running",
});

const PORT_FREE_ATTEMPTS = 10;
const PORT_FREE_INTERVAL_MS = 500;

export class PortBlockedError extends Error {
  constructor(port) {
    super(`Port ${port} is used by a program that is not a working Talking Tokens bridge. `
      + "Restart the computer, or close that program, then start the bridge again.");
  }
}

/**
 * Decide whether this process may start: one bridge at a time, and a hung bridge must not block the user.
 * @param {{port: number, probe: () => Promise<string>, readLock: () => Promise<object|null>,
 *   endHungBridge: (lock: object) => Promise<boolean>, wait: (ms: number) => Promise<void>}} deps
 * @returns {Promise<string>} A value of START_DECISION.
 * @throws {PortBlockedError}
 */
export async function decideStart({ port, probe, readLock, endHungBridge, wait }) {
  const existing = await probe();
  if (existing === EXISTING_BRIDGE.NONE) return START_DECISION.START;
  if (existing === EXISTING_BRIDGE.RUNNING) return START_DECISION.ALREADY_RUNNING;

  const lock = await readLock();
  if (!lock || !(await endHungBridge(lock))) throw new PortBlockedError(port);
  // The OS frees the port a moment after the process ends.
  for (let attempt = 0; attempt < PORT_FREE_ATTEMPTS; attempt += 1) {
    if ((await probe()) === EXISTING_BRIDGE.NONE) return START_DECISION.START;
    await wait(PORT_FREE_INTERVAL_MS);
  }
  throw new PortBlockedError(port);
}
