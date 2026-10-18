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

  /** @param {() => void} listener  Called when someone changes voice channel, or the bot joins or leaves a server. */
  onChange(listener) {
    for (const event of [Events.VoiceStateUpdate, Events.GuildCreate, Events.GuildDelete]) {
      this.#client.on(event, () => listener());
    }
  }

  async close() {
    await this.#client.destroy();
  }
}
