import { MODULE_ID } from "./module-id.mjs";
import { clampAnchor, DEFAULT_ANCHOR } from "./tokens/indicator-layout.mjs";
import {
  addCustomBubble, FALLBACK_BUBBLE_ID, isCustomBubbleList, removeCustomBubble,
} from "./tokens/bubble-library.mjs";

const KEY = Object.freeze({
  USER_MAPPING: "userMapping",
  ANCHOR: "indicatorAnchor",
  DEFAULT_BUBBLE: "defaultBubble",
  BUBBLE_LIBRARY: "bubbleLibrary",
  SCALE: "indicatorScale",
  HOLD_TIME: "holdTimeMs",
  AUTO_CONNECT: "autoConnect",
  SHOW_INDICATORS: "showIndicators",
});

const label = (key) => ({
  name: `TALKING_TOKENS.Settings.${key}.Name`,
  hint: `TALKING_TOKENS.Settings.${key}.Hint`,
});

/**
 * World settings are the GM's: in v11 only users with SETTINGS_MODIFY (Assistant GM and up by default) see and
 * change them. The only setting for players is "Show speech indicators".
 * @param {{onIndicatorChange: () => void, onMappingChange: () => void}} callbacks
 */
export function registerSettings({ onIndicatorChange, onMappingChange }) {
  const register = (key, data) => game.settings.register(MODULE_ID, key, data);
  const indicatorSetting = { scope: "world", onChange: onIndicatorChange };

  // Not secret: the mapping only links Foundry users to Discord ids. The bot token never comes to Foundry.
  register(KEY.USER_MAPPING, { scope: "world", config: false, type: Object, default: {}, onChange: onMappingChange });
  // The look of the bubble is a live control in the GM panel ("Bubble settings"), not in the settings window
  // (FOUNDRY_MODULE_RULES.md 10.3): the anchor (presets and drag), the library, the default bubble, and the size.
  register(KEY.ANCHOR, { ...indicatorSetting, config: false, type: Object, default: DEFAULT_ANCHOR });
  register(KEY.BUBBLE_LIBRARY, { ...indicatorSetting, config: false, type: Array, default: [] });
  register(KEY.DEFAULT_BUBBLE, { ...indicatorSetting, config: false, type: String, default: FALLBACK_BUBBLE_ID });
  register(KEY.SCALE, { ...indicatorSetting, config: false, type: Number, default: 1 });
  register(KEY.HOLD_TIME, {
    ...label(KEY.HOLD_TIME), scope: "world", config: true, type: Number, default: 300,
    range: { min: 0, max: 2000, step: 50 },
  });

  // GM only in practice: a checkbox in the GM panel, so players do not see it.
  register(KEY.AUTO_CONNECT, { scope: "client", config: false, type: Boolean, default: true });
  register(KEY.SHOW_INDICATORS, {
    ...label(KEY.SHOW_INDICATORS), scope: "client", config: true, type: Boolean, default: true,
    onChange: onIndicatorChange,
  });
}

const get = (key) => game.settings.get(MODULE_ID, key);
const set = (key, value) => game.settings.set(MODULE_ID, key, value);

/** @returns {Record<string, string>} Foundry user id → Discord id. */
export function getUserMapping() {
  return { ...get(KEY.USER_MAPPING) };
}

/**
 * Read the mapping right before the write, so that a change by another GM in the meantime is kept.
 * @param {(mapping: Record<string, string>) => Record<string, string>} change
 */
export function updateUserMapping(change) {
  return set(KEY.USER_MAPPING, change(getUserMapping()));
}

export const getHoldTimeMs = () => get(KEY.HOLD_TIME);
export const isAutoConnectOn = () => get(KEY.AUTO_CONNECT);
export const setAutoConnect = (isOn) => set(KEY.AUTO_CONNECT, isOn);
export const areIndicatorsShown = () => get(KEY.SHOW_INDICATORS);
export const getIndicatorAnchor = () => clampAnchor(get(KEY.ANCHOR));
export const setIndicatorAnchor = (anchor) => set(KEY.ANCHOR, clampAnchor(anchor));

/** The size slider of the panel; the same limits apply to a stored value from a macro. */
export const SCALE_RANGE = Object.freeze({ min: 0.25, max: 3, step: 0.05 });
const clampScale = (scale) => (Number.isFinite(scale) ? Math.min(Math.max(scale, SCALE_RANGE.min), SCALE_RANGE.max) : 1);
export const getIndicatorScale = () => clampScale(get(KEY.SCALE));
export const setIndicatorScale = (scale) => set(KEY.SCALE, clampScale(scale));

export const getDefaultBubbleId = () => get(KEY.DEFAULT_BUBBLE);
export const setDefaultBubbleId = (bubbleId) => set(KEY.DEFAULT_BUBBLE, bubbleId);

/** @returns {import("./tokens/bubble-library.mjs").CustomBubble[]} An invalid stored value counts as empty. */
export function getCustomBubbles() {
  const value = get(KEY.BUBBLE_LIBRARY);
  return isCustomBubbleList(value) ? value : [];
}

/** Read right before the write, so an image that another GM adds in the meantime is kept. */
export function addLibraryBubble(path) {
  return set(KEY.BUBBLE_LIBRARY, addCustomBubble(getCustomBubbles(), path, foundry.utils.randomID()));
}

/**
 * The owner of the library writes: a removed image must not stay the default. Tokens that use it fall back to the
 * default when the bubble is resolved (bubble-library.mjs).
 */
export async function removeLibraryBubble(bubbleId) {
  await set(KEY.BUBBLE_LIBRARY, removeCustomBubble(getCustomBubbles(), bubbleId));
  if (getDefaultBubbleId() === bubbleId) await setDefaultBubbleId(FALLBACK_BUBBLE_ID);
}
