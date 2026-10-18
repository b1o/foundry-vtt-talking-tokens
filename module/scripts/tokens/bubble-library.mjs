import { MODULE_ID } from "../module-id.mjs";

/**
 * The bubble library: the bubbles that ship in assets/bubbles, plus the images that the GM adds. The world default
 * and the bubble of one token are both ids from this library.
 *
 * @typedef {{id: string, path: string}} CustomBubble  An image that the GM added.
 * @typedef {object} Bubble
 * @property {string} id
 * @property {string} path
 * @property {boolean} isShipped  Shipped bubbles cannot be removed.
 * @property {string} name        For a shipped bubble, a text key; for an added image, its file name.
 */

const SHIPPED_IDS = Object.freeze(["classic", "dots", "thought", "shout", "whisper"]);

export const FALLBACK_BUBBLE_ID = "classic";

export const shippedBubblePath = (id) => `modules/${MODULE_ID}/assets/bubbles/${id}.svg`;

export const FALLBACK_BUBBLE_PATH = shippedBubblePath(FALLBACK_BUBBLE_ID);

/** @returns {Bubble[]} The shipped bubbles first, then the added images in the order of addition. */
export function buildLibrary(customBubbles) {
  return [
    ...SHIPPED_IDS.map((id) => ({
      id, path: shippedBubblePath(id), isShipped: true, name: `TALKING_TOKENS.BubbleStyle.${id}`,
    })),
    ...customBubbles.map(({ id, path }) => ({ id, path, isShipped: false, name: fileName(path) })),
  ];
}

/**
 * The first candidate that is in the library, else the classic bubble. Applied on every read, so a token, an actor,
 * or a default that points to a removed image still gets a bubble.
 * @param {Bubble[]} library
 * @param {(string|null)[]} candidateIds  In the order of use, for example [token, actor, world default].
 * @returns {Bubble}
 */
export function resolveBubble(library, candidateIds) {
  const find = (id) => library.find((bubble) => bubble.id === id);
  for (const id of candidateIds) {
    const bubble = id && find(id);
    if (bubble) return bubble;
  }
  return find(FALLBACK_BUBBLE_ID);
}

/** @returns {CustomBubble[]} The list with the image added, or the same list if the image is in it already. */
export function addCustomBubble(customBubbles, path, newId) {
  if (customBubbles.some((bubble) => bubble.path === path)) return customBubbles;
  return [...customBubbles, { id: newId, path }];
}

/** @returns {CustomBubble[]} */
export function removeCustomBubble(customBubbles, id) {
  return customBubbles.filter((bubble) => bubble.id !== id);
}

/** Validate at the boundary: the setting is world data that a macro can change. */
export function isCustomBubbleList(value) {
  const isText = (text) => typeof text === "string" && text.length > 0;
  return Array.isArray(value) && value.every((bubble) => isText(bubble?.id) && isText(bubble?.path)
    && !SHIPPED_IDS.includes(bubble.id));
}

function fileName(path) {
  return path.split("/").pop().replace(/\.[^.]+$/, "");
}
