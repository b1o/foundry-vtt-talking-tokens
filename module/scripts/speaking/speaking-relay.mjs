import { toUserIds } from "../mapping/user-mapping.mjs";
import { SOCKET_NAME } from "../module-id.mjs";
import { log } from "../output.mjs";

const SPEAKING_USERS = "speaking-users";

/** How long the Test button of the panel shows a user as speaking. */
const TEST_DURATION_MS = 3_000;

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
  #timers;
  #speakingDiscordIds = new Set();
  /** Users that the GM tests with the panel; they show as speaking on every client, as if they spoke. */
  #testUserIds = new Set();
  #lastUserIds = [];
  /**
   * Only a client that gets data from the bridge may publish. On any other client an empty list would be a lie,
   * and it would clear the indicators that the active GM sent.
   */
  #hasBridgeData = false;

  /**
   * @param {{socket: {emit: Function, on: Function}, isActiveGm: () => boolean, getActiveGmId: () => string|null,
   *   getUserMapping: () => import("../mapping/user-mapping.mjs").UserMapping,
   *   onSpeakingUsers: (userIds: string[]) => void, timers: import("../bridge/bridge-client.mjs").Timers}} options
   */
  constructor({ socket, isActiveGm, getActiveGmId, getUserMapping, onSpeakingUsers, timers }) {
    this.#socket = socket;
    this.#isActiveGm = isActiveGm;
    this.#getActiveGmId = getActiveGmId;
    this.#getUserMapping = getUserMapping;
    this.#onSpeakingUsers = onSpeakingUsers;
    this.#timers = timers;
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

  /**
   * Show the user as speaking for a few seconds, through the same path as real speech. Other clients see it only if
   * this client is the active GM, because the clients accept lists only from the active GM.
   */
  startTest(userId) {
    if (this.#testUserIds.has(userId)) return;
    this.#testUserIds.add(userId);
    this.#publish();
    this.#timers.setTimeout(() => {
      this.#testUserIds.delete(userId);
      this.#publish();
    }, TEST_DURATION_MS);
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
    const speaking = new Set([...toUserIds(this.#getUserMapping(), this.#speakingDiscordIds), ...this.#testUserIds]);
    return [...speaking].sort();
  }

  #send(userIds) {
    this.#lastUserIds = userIds;
    this.#onSpeakingUsers(userIds);
    if (this.#isActiveGm()) this.#socket.emit(SOCKET_NAME, { type: SPEAKING_USERS, userIds });
  }
}
