/**
 * Who shows as speaking on this client. A user starts to show at once, and stops after the hold time, so the
 * indicator does not flicker in the short pauses between words.
 */
export class SpeakingState {
  #getHoldTimeMs;
  #timers;
  #onChange;
  #shownUserIds = new Set();
  #stopTimers = new Map();

  /**
   * @param {{getHoldTimeMs: () => number, timers: import("../bridge/bridge-client.mjs").Timers,
   *   onChange: (userId: string, speaking: boolean) => void}} options
   */
  constructor({ getHoldTimeMs, timers, onChange }) {
    this.#getHoldTimeMs = getHoldTimeMs;
    this.#timers = timers;
    this.#onChange = onChange;
  }

  get speakingUserIds() {
    return [...this.#shownUserIds];
  }

  /** @param {string[]} userIds  Everyone who speaks now. */
  setSpeakingUsers(userIds) {
    const speaking = new Set(userIds);
    for (const userId of speaking) this.#start(userId);
    for (const userId of this.#shownUserIds) {
      if (!speaking.has(userId)) this.#scheduleStop(userId);
    }
  }

  #start(userId) {
    this.#cancelStop(userId);
    if (this.#shownUserIds.has(userId)) return;
    this.#shownUserIds.add(userId);
    this.#onChange(userId, true);
  }

  #scheduleStop(userId) {
    if (this.#stopTimers.has(userId)) return;
    const stop = () => {
      this.#stopTimers.delete(userId);
      this.#shownUserIds.delete(userId);
      this.#onChange(userId, false);
    };
    const holdTimeMs = this.#getHoldTimeMs();
    if (holdTimeMs <= 0) stop();
    else this.#stopTimers.set(userId, this.#timers.setTimeout(stop, holdTimeMs));
  }

  #cancelStop(userId) {
    if (!this.#stopTimers.has(userId)) return;
    this.#timers.clearTimeout(this.#stopTimers.get(userId));
    this.#stopTimers.delete(userId);
  }
}
