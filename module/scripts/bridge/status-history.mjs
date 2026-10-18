const DEFAULT_LIMIT = 50;

/**
 * @typedef {{time: Date, state: string, channelName: string|null}} StatusEntry
 */

/**
 * The last status changes of the connection, for the diagnostics that the GM copies into a bug report. Only a
 * change makes an entry, so a refresh with the same status adds nothing.
 */
export class StatusHistory {
  #now;
  #limit;
  /** @type {StatusEntry[]} */
  #entries = [];

  /** @param {{now: () => Date, limit?: number}} options */
  constructor({ now, limit = DEFAULT_LIMIT }) {
    this.#now = now;
    this.#limit = limit;
  }

  /** @returns {StatusEntry[]} The oldest first. */
  get entries() {
    return [...this.#entries];
  }

  /** @param {import("./connection-status.mjs").ConnectionStatus} status */
  record({ state, channelName }) {
    const last = this.#entries.at(-1);
    if (last?.state === state && last.channelName === channelName) return;
    this.#entries.push({ time: this.#now(), state, channelName });
    if (this.#entries.length > this.#limit) this.#entries.shift();
  }
}
