/**
 * The mapping is a plain object: Foundry user id → Discord id. One Discord account belongs to one Foundry user.
 * @typedef {Record<string, string>} UserMapping
 */

/**
 * @param {UserMapping} mapping
 * @param {Iterable<string>} discordIds
 * @returns {string[]} The Foundry user ids of the mapped Discord ids, sorted. Unmapped ids are left out.
 */
export function toUserIds(mapping, discordIds) {
  const wanted = new Set(discordIds);
  return Object.keys(mapping).filter((userId) => wanted.has(mapping[userId])).sort();
}

/**
 * @param {UserMapping} mapping
 * @param {string} userId
 * @param {string|null} discordId  Null removes the link of the user.
 * @returns {UserMapping} A new mapping. A Discord id that another user had moves to this user.
 */
export function assignDiscordId(mapping, userId, discordId) {
  const next = Object.fromEntries(Object.entries(mapping).filter(([, id]) => id !== discordId));
  delete next[userId];
  if (discordId) next[userId] = discordId;
  return next;
}
