import { PANEL_STATE } from "../bridge/connection-status.mjs";
import { BRIDGE_DOWNLOAD_URL, SETUP_GUIDE_URL } from "../links.mjs";
import { FALLBACK_BUBBLE_ID } from "../tokens/bubble-library.mjs";
import { ANCHOR_PRESETS } from "../tokens/indicator-layout.mjs";
import { toBubbleTile } from "./bubble-tile.mjs";

/** In these states the setup section opens by itself, because the GM must act there. */
const SETUP_STATES = new Set([PANEL_STATE.NO_TOKEN, PANEL_STATE.TOKEN_REJECTED, PANEL_STATE.NO_GM]);

/** In these states no usable bridge is connected, so the bot setup cannot work: it says why instead. */
const NO_BRIDGE_TEXT = {
  [PANEL_STATE.NOT_LOCALHOST]: "TALKING_TOKENS.Panel.SetupNeedsLocalhost",
  [PANEL_STATE.CONNECTING]: "TALKING_TOKENS.Panel.SetupNeedsBridge",
  [PANEL_STATE.BRIDGE_NOT_FOUND]: "TALKING_TOKENS.Panel.SetupNeedsBridge",
  [PANEL_STATE.INCOMPATIBLE]: "TALKING_TOKENS.Panel.SetupNeedsNewBridge",
};

/** Only these states have a Discord session, so only they can list voice members. */
const DISCORD_STATES = new Set([
  PANEL_STATE.NO_SERVER, PANEL_STATE.NO_GM, PANEL_STATE.GM_NOT_IN_VOICE, PANEL_STATE.MISSING_PERMISSION,
  PANEL_STATE.JOINING, PANEL_STATE.LISTENING, PANEL_STATE.RECONNECTING,
]);

/**
 * @typedef {object} PanelInput
 * @property {import("../bridge/connection-status.mjs").ConnectionStatus} status
 * @property {import("../protocol.mjs").VoiceMember[]} voiceMembers
 * @property {{id: string, name: string, isGM: boolean, speakerTokenNames: string[]}[]} users
 * @property {string} currentUserId
 * @property {import("../mapping/user-mapping.mjs").UserMapping} mapping
 * @property {string[]} speakingUserIds
 * @property {{accepted: boolean, error: string|null}|null} tokenResult  The reply to the last token that the GM sent.
 * @property {{isActive: boolean, tokenName: string|null}} placement
 * @property {boolean} isAutoConnectOn
 * @property {{library: import("../tokens/bubble-library.mjs").Bubble[], defaultBubbleId: string, scale: number,
 *   scaleRange: {min: number, max: number, step: number}}} bubbles
 */

/**
 * The data for templates/control-panel.hbs. Text keys are resolved in the template.
 * @param {PanelInput} input
 */
export function buildPanelView(input) {
  const {
    status, voiceMembers, users, mapping, speakingUserIds, tokenResult, placement, isAutoConnectOn, bubbles,
    currentUserId,
  } = input;
  const speaking = new Set(speakingUserIds);
  const hasDiscord = DISCORD_STATES.has(status.state);
  return {
    status: {
      ...status,
      textKey: `TALKING_TOKENS.Status.${status.state}`,
      actionKey: status.action ? `TALKING_TOKENS.Action.${status.action}` : null,
    },
    isSetupOpen: SETUP_STATES.has(status.state),
    canSetToken: !NO_BRIDGE_TEXT[status.state],
    noBridgeTextKey: NO_BRIDGE_TEXT[status.state] ?? null,
    canDownloadBridge: status.state !== PANEL_STATE.NOT_LOCALHOST,
    bridgeDownloadUrl: BRIDGE_DOWNLOAD_URL,
    voiceSummary: status.state === PANEL_STATE.LISTENING ? summarizeVoice(voiceMembers, mapping, status.channelName) : null,
    tokenResultKey: tokenResultKey(tokenResult),
    inviteUrl: status.inviteUrl,
    setupGuideUrl: SETUP_GUIDE_URL,
    gmCandidates: hasDiscord ? voiceMembers : [],
    hasDiscord,
    isAutoConnectOn,
    placement,
    bubbles: bubbleOptions(bubbles.library, bubbles.defaultBubbleId),
    scale: bubbles.scale,
    scaleRange: bubbles.scaleRange,
    presets: Object.keys(ANCHOR_PRESETS).map((name) => ({ name, labelKey: `TALKING_TOKENS.Preset.${name}` })),
    // The GM's own row: the GM's voice shows on a marked NPC, and the Test button checks that.
    players: users.filter((user) => !user.isGM || user.id === currentUserId).map((user) => ({
      id: user.id,
      name: user.name,
      isYou: user.id === currentUserId,
      isSpeaking: speaking.has(user.id),
      speakerTokenNames: user.speakerTokenNames.join(", "),
      options: memberOptions(voiceMembers, mapping[user.id] ?? null),
    })),
  };
}

/**
 * Who is in the bot's channel, and who of them has no Foundry user: their voice shows on no token.
 * The bridge reports the channel by name only; two servers with the same channel name count together.
 */
function summarizeVoice(voiceMembers, mapping, channelName) {
  const linkedIds = new Set(Object.values(mapping));
  const inChannel = voiceMembers.filter((member) => member.channelName === channelName);
  const unlinked = inChannel.filter((member) => !linkedIds.has(member.id));
  return {
    memberCount: inChannel.length,
    linkedCount: inChannel.length - unlinked.length,
    unlinkedNames: unlinked.map((member) => member.name).join(", "),
  };
}

function bubbleOptions(library, defaultBubbleId) {
  // A default that points to a removed image shows the classic bubble, so mark the bubble that really shows.
  const shownId = library.some((bubble) => bubble.id === defaultBubbleId) ? defaultBubbleId : FALLBACK_BUBBLE_ID;
  return library.map((bubble) => ({ ...toBubbleTile(bubble, bubble.id === shownId), canRemove: !bubble.isShipped }));
}

function memberOptions(voiceMembers, linkedId) {
  const options = voiceMembers.map((member) => ({
    value: member.id, label: `${member.name} (#${member.channelName})`, selected: member.id === linkedId,
  }));
  // Keep a link to someone who is not in voice now, so the select does not look as if the link is gone.
  if (linkedId && !voiceMembers.some((member) => member.id === linkedId)) {
    options.unshift({ value: linkedId, labelKey: "TALKING_TOKENS.Panel.LinkedNotInVoice", selected: true });
  }
  return options;
}

function tokenResultKey(result) {
  if (!result) return null;
  return result.accepted ? "TALKING_TOKENS.Panel.TokenSaved" : `TALKING_TOKENS.TokenError.${result.error}`;
}
