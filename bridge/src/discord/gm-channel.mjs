/**
 * @typedef {object} VoiceTarget
 * @property {string} guildId
 * @property {string} channelId
 */

/**
 * A Discord user is in at most one voice channel at a time, so the first match is the only one.
 * @param {import("../../../module/scripts/protocol.mjs").VoiceMember[]} members  Everyone in voice that the bot sees.
 * @param {string} gmDiscordId
 * @returns {(VoiceTarget & {channelName: string}) | null}
 */
export function findGmChannel(members, gmDiscordId) {
  const gm = members.find((member) => member.id === gmDiscordId);
  return gm ? { guildId: gm.guildId, channelId: gm.channelId, channelName: gm.channelName } : null;
}

export function isSameTarget(a, b) {
  return a?.guildId === b?.guildId && a?.channelId === b?.channelId;
}
