import { entersState, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";

/** How long a dropped voice connection may take to start its own reconnect, before we give it up. */
const RECONNECT_GRACE_MS = 5_000;

/**
 * @typedef {object} VoiceEvents
 * @property {(discordId: string) => void} onSpeakingStart
 * @property {(discordId: string) => void} onSpeakingEnd
 * @property {() => void} onReady
 * @property {() => void} onLost  The connection ended without a call to leave().
 */

/** The voice connection of the bot. There is at most one at a time. */
export class VoiceListener {
  #events;
  #join;
  #connection = null;
  #target = null;

  /**
   * @param {VoiceEvents} events
   * @param {typeof joinVoiceChannel} join
   */
  constructor(events, join = joinVoiceChannel) {
    this.#events = events;
    this.#join = join;
  }

  /** @returns {import("./gm-channel.mjs").VoiceTarget|null} */
  get target() {
    return this.#target;
  }

  join(target, adapterCreator) {
    this.leave();
    const connection = this.#join({
      guildId: target.guildId,
      channelId: target.channelId,
      adapterCreator,
      // A deafened bot receives no voice packets, so it could not see who speaks.
      selfDeaf: false,
      selfMute: true,
    });
    this.#connection = connection;
    this.#target = target;

    const isCurrent = () => this.#connection === connection;
    connection.on(VoiceConnectionStatus.Ready, () => isCurrent() && this.#events.onReady());
    connection.on(VoiceConnectionStatus.Disconnected, () => this.#onDisconnected(connection, isCurrent));
    connection.receiver.speaking.on("start", (id) => isCurrent() && this.#events.onSpeakingStart(id));
    connection.receiver.speaking.on("end", (id) => isCurrent() && this.#events.onSpeakingEnd(id));
  }

  leave() {
    const connection = this.#connection;
    this.#connection = null;
    this.#target = null;
    connection?.destroy();
  }

  // The recovery that the @discordjs/voice documentation describes: a connection that moves to Signalling or
  // Connecting soon reconnects by itself (for example after a server region change). Otherwise it is gone.
  async #onDisconnected(connection, isCurrent) {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, RECONNECT_GRACE_MS),
        entersState(connection, VoiceConnectionStatus.Connecting, RECONNECT_GRACE_MS),
      ]);
    } catch {
      if (!isCurrent()) return;
      this.leave();
      this.#events.onLost();
    }
  }
}
