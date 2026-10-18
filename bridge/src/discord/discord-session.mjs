import { once } from "node:events";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { TOKEN_ERROR } from "../../../module/scripts/protocol.mjs";

export class LoginError extends Error {
  /** @param {string} code  A value of TOKEN_ERROR. */
  constructor(code, cause) {
    super(`Discord login failed: ${code}`, { cause });
    this.code = code;
  }
}

// GuildVoiceStates includes the member (name, avatar) of everyone in voice, so the privileged GuildMembers intent
// is not necessary.
const INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];

// The channel and role events come with the Guilds intent; a channel update carries the permission overwrites, which
// is the fix that the guide gives. A member update needs the privileged GuildMembers intent, which the bot does not
// ask for; if Discord sends none, a new role of the bot counts at the next channel, role, or voice event.
const CHANGE_EVENTS = [
  Events.VoiceStateUpdate, Events.GuildCreate, Events.GuildDelete, Events.ChannelUpdate, Events.GuildRoleCreate,
  Events.GuildRoleUpdate, Events.GuildRoleDelete, Events.GuildMemberUpdate,
];

/** The gateway close code for a token that Discord no longer accepts (GatewayCloseCodes.AuthenticationFailed). */
const AUTHENTICATION_FAILED = 4004;

/** One logged-in Discord bot. It translates discord.js objects into the plain data of protocol.mjs. */
export class DiscordSession {
  #client;

  /**
   * @param {string} token
   * @param {() => Client} createClient
   * @returns {Promise<DiscordSession>}
   * @throws {LoginError}
   */
  static async open(token, createClient = () => new Client({ intents: INTENTS })) {
    const client = createClient();
    try {
      const ready = once(client, Events.ClientReady);
      await client.login(token);
      await ready;
    } catch (error) {
      await client.destroy();
      throw new LoginError(error.code === "TokenInvalid" ? TOKEN_ERROR.REJECTED : TOKEN_ERROR.DISCORD_UNREACHABLE, error);
    }
    return new DiscordSession(client);
  }

  constructor(client) {
    this.#client = client;
  }

  get botTag() {
    return this.#client.user.tag;
  }

  get applicationId() {
    return this.#client.application.id;
  }

  get serverCount() {
    return this.#client.guilds.cache.size;
  }

  /** @returns {import("../../../module/scripts/protocol.mjs").VoiceMember[]} Everyone in voice except the bot. */
  listVoiceMembers() {
    const botId = this.#client.user.id;
    return this.#client.guilds.cache.flatMap((guild) => guild.voiceStates.cache)
      .filter((state) => state.channel && state.member && state.id !== botId)
      .map((state) => ({
        id: state.id,
        name: state.member.displayName,
        avatarUrl: state.member.displayAvatarURL({ size: 64 }),
        guildId: state.guild.id,
        channelId: state.channel.id,
        channelName: state.channel.name,
      }));
  }

  /** Has the bot the permissions to connect, and is the channel not full? */
  canJoin({ guildId, channelId }) {
    return this.#client.guilds.cache.get(guildId)?.channels.cache.get(channelId)?.joinable ?? false;
  }

  voiceAdapterCreator(guildId) {
    return this.#client.guilds.cache.get(guildId).voiceAdapterCreator;
  }

  /**
   * @param {() => void} listener  Called when someone changes voice channel, the bot joins or leaves a server, or a
   *   permission can change: a channel update (permission overwrites), a role change, or a change of the bot's roles.
   */
  onChange(listener) {
    for (const event of CHANGE_EVENTS) this.#client.on(event, () => listener());
  }

  /**
   * The gateway connection to Discord. discord.js reconnects by itself; onLost means it gave up
   * (WebSocketManager: an unrecoverable close code).
   * @param {{onReconnecting: () => void, onBack: () => void, onLost: (code: string) => void}} listener
   *   code is a value of TOKEN_ERROR.
   */
  onGatewayChange({ onReconnecting, onBack, onLost }) {
    this.#client.on(Events.ShardReconnecting, () => onReconnecting());
    this.#client.on(Events.ShardResume, () => onBack());
    this.#client.on(Events.ShardReady, () => onBack());
    this.#client.on(Events.ShardDisconnect, (event) => onLost(
      event.code === AUTHENTICATION_FAILED ? TOKEN_ERROR.REJECTED : TOKEN_ERROR.DISCORD_UNREACHABLE,
    ));
  }

  async close() {
    await this.#client.destroy();
  }
}
