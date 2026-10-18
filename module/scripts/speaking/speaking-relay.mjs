import { toUserIds } from "../mapping/user-mapping.mjs";
import { SOCKET_NAME } from "../module-id.mjs";
import { log } from "../output.mjs";

const SPEAKING_USERS = "speaking-users";

const isSpeakingUsersMessage = (data) => data?.type === SPEAKING_USERS && Array.isArray(data.userIds)
  && data.userIds.every((id) => typeof id === "string");

/**
 * Moves the speaking state from the bridge to every client. The GM client turns Discord ids into Foundry user ids
 * and sends the full list of speaking users on the Foundry socket. A full list, not single changes, so a lost or
 * late message cannot leave a token speaking.
 */
export class SpeakingRelay {
  #socket;
  #isActiveGm;
  #getActiveGmId;
  #getUserMapping;
  #onSpeakingUsers;
  #speakingDiscordIds = new Set();
  #lastUserIds = [];
  /**
   * Only a client that gets data from the bridge may publish. On any other client an empty list would be a lie,
   * and it would clear the indicators that the active GM sent.
   */
  #hasBridgeData = false;

  /**
   * @param {{socket: {emit: Function, on: Function}, isActiveGm: () => boolean, getActiveGmId: () => string|null,
   *   getUserMapping: () => import("../mapping/user-mapping.mjs").UserMapping,
   *   onSpeakingUsers: (userIds: string[]) => void}} options
   */
  constructor({ socket, isActiveGm, getActiveGmId, getUserMapping, onSpeakingUsers }) {
    this.#socket = socket;
    this.#isActiveGm = isActiveGm;
    this.#getActiveGmId = getActiveGmId;
    this.#getUserMapping = getUserMapping;
    this.#onSpeakingUsers = onSpeakingUsers;
  }

  /** Receive the lists that the active GM sends. Foundry does not echo a message back to its sender. */
  listen() {
    this.#socket.on(SOCKET_NAME, (data, senderId) => {
      if (senderId !== this.#getActiveGmId()) return;
      if (!isSpeakingUsersMessage(data)) {
        log.warn("Ignored an invalid socket message.", data);
        return;
      }
      this.#onSpeakingUsers(data.userIds);
    });
  }

  onBridgeSnapshot(discordIds) {
    this.#hasBridgeData = true;
    this.#speakingDiscordIds = new Set(discordIds);
    this.#publish();
  }

  onBridgeSpeaking(discordId, speaking) {
    this.#hasBridgeData = true;
    if (speaking) this.#speakingDiscordIds.add(discordId);
    else this.#speakingDiscordIds.delete(discordId);
    this.#publish();
  }

  /** Send the list again, for example after a mapping change or when a player joins. */
  republish() {
    if (this.#hasBridgeData) this.#send(this.#currentUserIds());
  }

  #publish() {
    const userIds = this.#currentUserIds();
    if (userIds.join() === this.#lastUserIds.join()) return;
    this.#send(userIds);
  }

  #currentUserIds() {
    return toUserIds(this.#getUserMapping(), this.#speakingDiscordIds);
  }

  #send(userIds) {
    this.#lastUserIds = userIds;
    this.#onSpeakingUsers(userIds);
    if (this.#isActiveGm()) this.#socket.emit(SOCKET_NAME, { type: SPEAKING_USERS, userIds });
  }
}
