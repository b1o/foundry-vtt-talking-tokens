/** Who speaks now. Reports only real changes, so a repeated "start" for the same user sends nothing. */
export class SpeakingTable {
  #speakingIds = new Set();
  #onChange;

  /** @param {(discordId: string, speaking: boolean) => void} onChange */
  constructor(onChange) {
    this.#onChange = onChange;
  }

  setSpeaking(discordId, speaking) {
    if (this.#speakingIds.has(discordId) === speaking) return;
    if (speaking) this.#speakingIds.add(discordId);
    else this.#speakingIds.delete(discordId);
    this.#onChange(discordId, speaking);
  }

  /** Report everyone as silent, for example when the bot leaves the channel. */
  clear() {
    for (const discordId of [...this.#speakingIds]) this.setSpeaking(discordId, false);
  }

  get speakingIds() {
    return [...this.#speakingIds];
  }
}
