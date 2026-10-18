/*
 * The messages between the bridge and the Foundry module. The bridge imports this file too, so it must not use
 * Foundry, browser, or Node APIs.
 *
 * Every message is one JSON object with a "type" field. The receiver validates each message before use.
 */

/** Increase on any change that an older receiver cannot read. */
export const PROTOCOL_VERSION = 2;

export const DEFAULT_BRIDGE_PORT = 37521;

/**
 * The path names the module, because the browser logs each failed connection by itself, with the URL only, and
 * code cannot add a prefix to that line. The bridge accepts any path.
 */
const BRIDGE_PATH = "/talking-tokens";

export function bridgeUrl(port = DEFAULT_BRIDGE_PORT) {
  return `ws://127.0.0.1:${port}${BRIDGE_PATH}`;
}

export const BRIDGE_MESSAGE = Object.freeze({
  HELLO: "hello",
  STATUS: "status",
  VOICE_MEMBERS: "voice-members",
  SPEAKING_SNAPSHOT: "speaking-snapshot",
  SPEAKING: "speaking",
  TOKEN_RESULT: "token-result",
});

export const MODULE_MESSAGE = Object.freeze({
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  SET_TOKEN: "set-token",
  SET_GM: "set-gm",
});

/** The states of the bridge, in the order of a normal start. */
export const BRIDGE_STATE = Object.freeze({
  NO_TOKEN: "no-token",
  IDLE: "idle",
  LOGGING_IN: "logging-in",
  TOKEN_REJECTED: "token-rejected",
  DISCORD_UNREACHABLE: "discord-unreachable",
  NO_SERVER: "no-server",
  NO_GM: "no-gm",
  GM_NOT_IN_VOICE: "gm-not-in-voice",
  MISSING_PERMISSION: "missing-permission",
  JOINING: "joining",
  LISTENING: "listening",
  /** The gateway connection to Discord dropped, and discord.js tries to resume it. */
  RECONNECTING: "reconnecting",
});

export const TOKEN_ERROR = Object.freeze({
  REJECTED: "token-rejected",
  DISCORD_UNREACHABLE: "discord-unreachable",
});

const isString = (value) => typeof value === "string";
const isNullableString = (value) => value === null || isString(value);
const isBoolean = (value) => typeof value === "boolean";
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const isOneOf = (values) => (value) => Object.values(values).includes(value);
const isArrayOf = (isItem) => (value) => Array.isArray(value) && value.every(isItem);
const isObjectWith = (schema) => (value) => typeof value === "object" && value !== null
  && Object.entries(schema).every(([field, isValid]) => isValid(value[field]));

/** Discord ids ("snowflakes") are 64-bit integers, sent as decimal strings. */
export const isDiscordId = (value) => isString(value) && /^\d{17,20}$/.test(value);

/**
 * @typedef {object} VoiceMember
 * @property {string} id
 * @property {string} name          The display name in the Discord server.
 * @property {string} avatarUrl
 * @property {string} guildId       The Discord server. Two servers can have channels with the same name.
 * @property {string} channelId
 * @property {string} channelName
 */
const isVoiceMember = isObjectWith({
  id: isDiscordId, name: isString, avatarUrl: isString, guildId: isDiscordId, channelId: isDiscordId,
  channelName: isString,
});

const BRIDGE_SCHEMAS = {
  [BRIDGE_MESSAGE.HELLO]: { protocolVersion: isPositiveInteger, bridgeVersion: isString },
  [BRIDGE_MESSAGE.STATUS]: {
    state: isOneOf(BRIDGE_STATE), botTag: isNullableString, inviteUrl: isNullableString,
    channelName: isNullableString,
  },
  [BRIDGE_MESSAGE.VOICE_MEMBERS]: { members: isArrayOf(isVoiceMember) },
  [BRIDGE_MESSAGE.SPEAKING_SNAPSHOT]: { speakingIds: isArrayOf(isDiscordId) },
  [BRIDGE_MESSAGE.SPEAKING]: { discordId: isDiscordId, speaking: isBoolean },
  [BRIDGE_MESSAGE.TOKEN_RESULT]: { accepted: isBoolean, error: (value) => value === null || isOneOf(TOKEN_ERROR)(value) },
};

const MODULE_SCHEMAS = {
  [MODULE_MESSAGE.CONNECT]: {},
  [MODULE_MESSAGE.DISCONNECT]: {},
  [MODULE_MESSAGE.SET_TOKEN]: { token: (value) => isString(value) && value.trim().length > 0 },
  [MODULE_MESSAGE.SET_GM]: { discordId: isDiscordId },
};

/**
 * @typedef {{message: object, error: null} | {message: null, error: string}} ParseResult
 */

/** @returns {ParseResult} A message from the bridge, as the module receives it. */
export function parseBridgeMessage(text) {
  return parseMessage(text, BRIDGE_SCHEMAS);
}

/** @returns {ParseResult} A message from the module, as the bridge receives it. */
export function parseModuleMessage(text) {
  return parseMessage(text, MODULE_SCHEMAS);
}

function parseMessage(text, schemas) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { message: null, error: "The message is not valid JSON." };
  }
  const schema = schemas[data?.type];
  if (!schema) return { message: null, error: `Unknown message type: ${String(data?.type)}` };
  const invalidField = Object.keys(schema).find((field) => !schema[field](data[field]));
  if (invalidField) return { message: null, error: `Message "${data.type}" has an invalid "${invalidField}".` };
  return { message: data, error: null };
}
