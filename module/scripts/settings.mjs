import { MODULE_ID } from "./module-id.mjs";
import { clampAnchor, DEFAULT_ANCHOR } from "./tokens/indicator-layout.mjs";
import { BUBBLE_STYLE } from "./tokens/bubble-styles.mjs";

const KEY = Object.freeze({
  USER_MAPPING: "userMapping",
  ANCHOR: "indicatorAnchor",
  BUBBLE_STYLE: "bubbleStyle",
  CUSTOM_IMAGE: "indicatorImage",
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
  // Set by the presets and the drag placement in the GM panel.
  register(KEY.ANCHOR, { ...indicatorSetting, config: false, type: Object, default: DEFAULT_ANCHOR });

  register(KEY.BUBBLE_STYLE, {
    ...label(KEY.BUBBLE_STYLE), ...indicatorSetting, config: true, type: String, default: BUBBLE_STYLE.CLASSIC,
    choices: Object.fromEntries(Object.values(BUBBLE_STYLE).map((style) => [style, `TALKING_TOKENS.BubbleStyle.${style}`])),
  });
  register(KEY.CUSTOM_IMAGE, {
    ...label(KEY.CUSTOM_IMAGE), ...indicatorSetting, config: true, type: String, default: "", filePicker: "image",
  });
  register(KEY.SCALE, {
    ...label(KEY.SCALE), ...indicatorSetting, config: true, type: Number, default: 1,
    range: { min: 0.25, max: 3, step: 0.05 },
  });
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
export const setIndicatorAnchor = (anchor) => set(KEY.ANCHOR, clampAnchor(anchor));

/**
 * @typedef {object} IndicatorStyle
 * @property {import("./tokens/indicator-layout.mjs").Anchor} anchor
 * @property {number} scale
 * @property {string} bubbleStyle       A value of BUBBLE_STYLE.
 * @property {string|null} customImagePath
 */

/** @returns {IndicatorStyle} */
export function getIndicatorStyle() {
  return {
    anchor: clampAnchor(get(KEY.ANCHOR)),
    scale: get(KEY.SCALE),
    bubbleStyle: get(KEY.BUBBLE_STYLE),
    customImagePath: get(KEY.CUSTOM_IMAGE) || null,
  };
}
