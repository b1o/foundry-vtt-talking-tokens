import {
  BRIDGE_MESSAGE, BRIDGE_STATE, MODULE_MESSAGE, PROTOCOL_VERSION, TOKEN_ERROR,
} from "../../module/scripts/protocol.mjs";
import { LoginError } from "./discord/discord-session.mjs";
import { findGmChannel, isSameTarget } from "./discord/gm-channel.mjs";
import { buildInviteUrl } from "./discord/invite-url.mjs";
import { SpeakingTable } from "./discord/speaking-table.mjs";

const STATE_FOR_LOGIN_ERROR = {
  [TOKEN_ERROR.REJECTED]: BRIDGE_STATE.TOKEN_REJECTED,
  [TOKEN_ERROR.DISCORD_UNREACHABLE]: BRIDGE_STATE.DISCORD_UNREACHABLE,
};

/**
 * @typedef {object} ControllerDependencies
 * @property {import("./config-store.mjs").ConfigStore} configStore
 * @property {(token: string) => Promise<import("./discord/discord-session.mjs").DiscordSession>} openSession
 * @property {(events: import("./discord/voice-listener.mjs").VoiceEvents) => import("./discord/voice-listener.mjs").VoiceListener} createVoiceListener
 * @property {(message: object) => void} broadcast  Sends a message to every connected Foundry client.
 * @property {(status: object) => void} showStatus
 * @property {string} bridgeVersion
 */

/**
 * The state machine of the bridge. Foundry commands and Discord events come in; status and speaking messages go
 * out. Only #setState changes the state.
 */
export class BridgeController {
  #deps;
  #config = { token: null, gmDiscordId: null };
  #session = null;
  #wantsConnection = false;
  /** Null until start() reads the config. */
  #status = null;
  /** The status to show again when the gateway is back after a reconnect. */
  #statusBeforeReconnect = null;
  #speakingTable;
  #voice;

  /** @param {ControllerDependencies} deps */
  constructor(deps) {
    this.#deps = deps;
    this.#speakingTable = new SpeakingTable((discordId, speaking) => {
      deps.broadcast({ type: BRIDGE_MESSAGE.SPEAKING, discordId, speaking });
    });
    this.#voice = deps.createVoiceListener({
      onSpeakingStart: (id) => this.#speakingTable.setSpeaking(id, true),
      onSpeakingEnd: (id) => this.#speakingTable.setSpeaking(id, false),
      onReady: () => this.#setState(BRIDGE_STATE.LISTENING, { channelName: this.#voice.target?.channelName }),
      onLost: () => this.#onVoiceLost(),
    });
  }

  async start() {
    this.#config = await this.#deps.configStore.load();
    this.#setState(this.#config.token ? BRIDGE_STATE.IDLE : BRIDGE_STATE.NO_TOKEN);
  }

  /** The messages that a newly connected Foundry client needs to show the current state. */
  welcomeMessages() {
    return [
      { type: BRIDGE_MESSAGE.HELLO, protocolVersion: PROTOCOL_VERSION, bridgeVersion: this.#deps.bridgeVersion },
      this.#status,
      this.#voiceMembersMessage(),
      { type: BRIDGE_MESSAGE.SPEAKING_SNAPSHOT, speakingIds: this.#speakingTable.speakingIds },
    ];
  }

  /**
   * @param {object} message  A valid module message (see parseModuleMessage).
   * @param {(message: object) => void} reply  Sends a message to the client that sent this one.
   */
  async handle(message, reply) {
    switch (message.type) {
      case MODULE_MESSAGE.CONNECT: return this.connect();
      case MODULE_MESSAGE.DISCONNECT: return this.disconnect();
      case MODULE_MESSAGE.SET_TOKEN: return this.#setToken(message.token.trim(), reply);
      case MODULE_MESSAGE.SET_GM: return this.#setGm(message.discordId);
    }
  }

  async connect() {
    this.#wantsConnection = true;
    if (this.#session) return this.#followGm();
    if (!this.#config.token || this.#status.state === BRIDGE_STATE.LOGGING_IN) return;
    this.#setState(BRIDGE_STATE.LOGGING_IN);
    try {
      await this.#adoptSession(await this.#deps.openSession(this.#config.token));
    } catch (error) {
      if (!(error instanceof LoginError)) throw error;
      this.#setState(STATE_FOR_LOGIN_ERROR[error.code]);
    }
  }

  async disconnect() {
    this.#wantsConnection = false;
    await this.#closeSession();
    this.#setState(this.#config.token ? BRIDGE_STATE.IDLE : BRIDGE_STATE.NO_TOKEN);
  }

  async #setToken(token, reply) {
    // Log in with the new token first. The old session keeps running until the new token works.
    let session;
    try {
      session = await this.#deps.openSession(token);
    } catch (error) {
      if (!(error instanceof LoginError)) throw error;
      reply({ type: BRIDGE_MESSAGE.TOKEN_RESULT, accepted: false, error: error.code });
      return;
    }
    try {
      this.#config = await this.#deps.configStore.update({ token });
    } catch (error) {
      await session.close();
      throw error;
    }
    await this.#closeSession();
    reply({ type: BRIDGE_MESSAGE.TOKEN_RESULT, accepted: true, error: null });
    this.#wantsConnection = true;
    await this.#adoptSession(session);
  }

  async #setGm(discordId) {
    this.#config = await this.#deps.configStore.update({ gmDiscordId: discordId });
    this.#followGm();
  }

  async #adoptSession(session) {
    if (!this.#wantsConnection) {
      await session.close();
      return;
    }
    this.#session = session;
    session.onChange(() => this.#onDiscordChange());
    session.onGatewayChange({
      onReconnecting: () => this.#onGatewayReconnecting(session),
      onBack: () => this.#onGatewayBack(session),
      onLost: (code) => this.#onGatewayLost(session, code),
    });
    this.#onDiscordChange();
  }

  #onGatewayReconnecting(session) {
    if (session !== this.#session || this.#status.state === BRIDGE_STATE.RECONNECTING) return;
    this.#statusBeforeReconnect = this.#status;
    this.#setState(BRIDGE_STATE.RECONNECTING, { channelName: this.#status.channelName });
  }

  /**
   * The status from before the outage is still true unless something changed meanwhile; #followGm corrects that.
   * A voice event during the outage already set a newer state, which stays.
   */
  #onGatewayBack(session) {
    if (session !== this.#session) return;
    const before = this.#statusBeforeReconnect;
    this.#statusBeforeReconnect = null;
    if (before && this.#status.state === BRIDGE_STATE.RECONNECTING) {
      this.#setState(before.state, { channelName: before.channelName });
    }
    this.#onDiscordChange();
  }

  /** discord.js gave up the gateway connection, so the session is dead. Connect starts a new one. */
  async #onGatewayLost(session, code) {
    if (session !== this.#session) return;
    this.#statusBeforeReconnect = null;
    await this.#closeSession();
    this.#setState(STATE_FOR_LOGIN_ERROR[code]);
  }

  /**
   * Forget the session before it closes: discord.js emits events while it closes (a normal close of the gateway
   * emits shardReconnecting), and the handlers ignore a session that is not the current one.
   */
  async #closeSession() {
    const session = this.#session;
    this.#session = null;
    this.#leaveVoice();
    await session?.close();
    this.#deps.broadcast(this.#voiceMembersMessage());
  }

  #onDiscordChange() {
    this.#deps.broadcast(this.#voiceMembersMessage());
    this.#followGm();
  }

  #onVoiceLost() {
    this.#speakingTable.clear();
    this.#followGm();
  }

  /** Decide where the bot must be, from the current voice states. Every Discord change ends here. */
  #followGm() {
    const session = this.#session;
    if (!session) return;
    if (session.serverCount === 0) return this.#stayOutOfVoice(BRIDGE_STATE.NO_SERVER);
    if (!this.#config.gmDiscordId) return this.#stayOutOfVoice(BRIDGE_STATE.NO_GM);

    const target = findGmChannel(session.listVoiceMembers(), this.#config.gmDiscordId);
    if (!target) return this.#stayOutOfVoice(BRIDGE_STATE.GM_NOT_IN_VOICE);
    if (isSameTarget(target, this.#voice.target)) return;
    if (!session.canJoin(target)) return this.#stayOutOfVoice(BRIDGE_STATE.MISSING_PERMISSION, target.channelName);

    this.#leaveVoice();
    this.#voice.join(target, session.voiceAdapterCreator(target.guildId));
    this.#setState(BRIDGE_STATE.JOINING, { channelName: target.channelName });
  }

  #stayOutOfVoice(state, channelName = null) {
    this.#leaveVoice();
    this.#setState(state, { channelName });
  }

  #leaveVoice() {
    this.#voice.leave();
    this.#speakingTable.clear();
  }

  #setState(state, { channelName = null } = {}) {
    const session = this.#session;
    const status = {
      type: BRIDGE_MESSAGE.STATUS,
      state,
      botTag: session?.botTag ?? null,
      inviteUrl: session ? buildInviteUrl(session.applicationId) : null,
      channelName,
    };
    if (JSON.stringify(status) === JSON.stringify(this.#status)) return;
    this.#status = status;
    this.#deps.broadcast(status);
    this.#deps.showStatus(status);
  }

  #voiceMembersMessage() {
    return { type: BRIDGE_MESSAGE.VOICE_MEMBERS, members: this.#session?.listVoiceMembers() ?? [] };
  }
}
