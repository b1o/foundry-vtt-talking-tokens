import { BRIDGE_MESSAGE, BRIDGE_STATE, MODULE_MESSAGE, PROTOCOL_VERSION } from "../protocol.mjs";
import { log } from "../output.mjs";
import { LINK_STATE } from "./bridge-client.mjs";

/**
 * @typedef {object} BridgeFacts  What the GM client knows about the bridge now.
 * @property {string} linkState            A value of LINK_STATE.
 * @property {boolean} isCompatible        False if the bridge speaks another protocol version.
 * @property {string|null} bridgeVersion
 * @property {object|null} status          The last status message of the bridge.
 * @property {import("../protocol.mjs").VoiceMember[]} voiceMembers
 * @property {{accepted: boolean, error: string|null}|null} tokenResult  The reply to the last token sent.
 *
 * @typedef {object} LinkEvents
 * @property {(facts: BridgeFacts) => void} onChange
 * @property {(speakingIds: string[]) => void} onSpeakingSnapshot
 * @property {(discordId: string, speaking: boolean) => void} onSpeaking
 */

/** The GM side of the bridge connection: the facts that the bridge reports, and the commands to it. */
export class BridgeLink {
  #createClient;
  #client;
  #isAutoConnectOn;
  #events;
  #autoConnectSent = false;
  #facts = {
    linkState: LINK_STATE.STOPPED, isCompatible: true, bridgeVersion: null, status: null, voiceMembers: [],
    tokenResult: null,
  };

  /**
   * @param {{createClient: (events: object) => import("./bridge-client.mjs").BridgeClient,
   *   isAutoConnectOn: () => boolean, events: LinkEvents}} options
   */
  constructor({ createClient, isAutoConnectOn, events }) {
    this.#createClient = createClient;
    this.#isAutoConnectOn = isAutoConnectOn;
    this.#events = events;
  }

  /** @returns {BridgeFacts} */
  get facts() {
    return this.#facts;
  }

  start() {
    this.#client ??= this.#createClient({
      onMessage: (message) => this.#onMessage(message),
      onLinkChange: (linkState) => this.#onLinkChange(linkState),
      onInvalidMessage: (error) => log.warn(`Ignored an invalid bridge message. ${error}`),
    });
    this.#client.start();
  }

  connectDiscord() {
    return this.#send({ type: MODULE_MESSAGE.CONNECT });
  }

  disconnectDiscord() {
    return this.#send({ type: MODULE_MESSAGE.DISCONNECT });
  }

  setToken(token) {
    this.#update({ tokenResult: null });
    return this.#send({ type: MODULE_MESSAGE.SET_TOKEN, token });
  }

  setGm(discordId) {
    return this.#send({ type: MODULE_MESSAGE.SET_GM, discordId });
  }

  #send(message) {
    return this.#facts.isCompatible && this.#client.send(message);
  }

  #onLinkChange(linkState) {
    // A lost link means that the bridge stopped, so its last facts are no longer true.
    const lost = linkState !== LINK_STATE.OPEN;
    this.#update({ linkState, ...(lost && { status: null, voiceMembers: [] }) });
    if (lost) this.#events.onSpeakingSnapshot([]);
  }

  #onMessage(message) {
    switch (message.type) {
      case BRIDGE_MESSAGE.HELLO:
        return this.#update({
          isCompatible: message.protocolVersion === PROTOCOL_VERSION, bridgeVersion: message.bridgeVersion,
        });
      case BRIDGE_MESSAGE.STATUS:
        this.#update({ status: message });
        return this.#autoConnect(message.state);
      case BRIDGE_MESSAGE.VOICE_MEMBERS: return this.#update({ voiceMembers: message.members });
      case BRIDGE_MESSAGE.SPEAKING_SNAPSHOT: return this.#events.onSpeakingSnapshot(message.speakingIds);
      case BRIDGE_MESSAGE.SPEAKING: return this.#events.onSpeaking(message.discordId, message.speaking);
      case BRIDGE_MESSAGE.TOKEN_RESULT:
        return this.#update({ tokenResult: { accepted: message.accepted, error: message.error } });
    }
  }

  /** Connect once per page load, so that a GM who clicks Disconnect stays disconnected until the next load. */
  #autoConnect(state) {
    if (state !== BRIDGE_STATE.IDLE || this.#autoConnectSent || !this.#isAutoConnectOn()) return;
    this.#autoConnectSent = this.connectDiscord();
  }

  #update(changes) {
    this.#facts = { ...this.#facts, ...changes };
    this.#events.onChange(this.#facts);
  }
}
