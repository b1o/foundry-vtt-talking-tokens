import { PANEL_STATE } from "../bridge/connection-status.mjs";
import { BRIDGE_DOWNLOAD_URL, SETUP_GUIDE_URL, TROUBLESHOOTING_URL } from "../links.mjs";
import { FALLBACK_BUBBLE_ID } from "../tokens/bubble-library.mjs";
import { ANCHOR_PRESETS } from "../tokens/indicator-layout.mjs";
import { toBubbleTile } from "./bubble-tile.mjs";

const LINK = Object.freeze({
  DOWNLOAD_BRIDGE: { labelKey: "TALKING_TOKENS.Panel.DownloadBridge", icon: "fa-download", url: BRIDGE_DOWNLOAD_URL },
  WHY_LOCALHOST: { labelKey: "TALKING_TOKENS.Panel.WhyLocalhost", icon: "fa-circle-question", url: TROUBLESHOOTING_URL },
  HOW_TO_FIX: { labelKey: "TALKING_TOKENS.Panel.HowToFix", icon: "fa-circle-question", url: TROUBLESHOOTING_URL },
});

/**
 * The step that a state asks the GM to do in the Setup section: a text, and a web page to open, if any. The status
 * text of these states points to the Setup section, so each step shows in one place only.
 */
const SETUP_STEP = {
  [PANEL_STATE.NOT_LOCALHOST]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsLocalhost", link: LINK.WHY_LOCALHOST },
  [PANEL_STATE.CONNECTING]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsBridge", link: LINK.DOWNLOAD_BRIDGE },
  [PANEL_STATE.BRIDGE_NOT_FOUND]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsBridge", link: LINK.DOWNLOAD_BRIDGE },
  [PANEL_STATE.INCOMPATIBLE]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsNewBridge", link: LINK.DOWNLOAD_BRIDGE },
  [PANEL_STATE.NO_TOKEN]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsToken", link: null },
  [PANEL_STATE.TOKEN_REJECTED]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsNewToken", link: null },
  [PANEL_STATE.NO_SERVER]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsInvite", link: null },
  [PANEL_STATE.NO_GM]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsGm", link: null },
  [PANEL_STATE.MISSING_PERMISSION]: { textKey: "TALKING_TOKENS.Panel.SetupNeedsPermission", link: LINK.HOW_TO_FIX },
};

/** The states in which the bridge needs a (new) token. */
const TOKEN_STATES = new Set([PANEL_STATE.NO_TOKEN, PANEL_STATE.TOKEN_REJECTED]);

/** "Looking for the bridge" lasts a moment on each load; the Setup section does not open for it. */
const PASSING_STATES = new Set([PANEL_STATE.CONNECTING]);

/** In these states no usable bridge is connected, so the panel cannot send a token to it. */
const NO_BRIDGE_STATES = new Set([
  PANEL_STATE.NOT_LOCALHOST, PANEL_STATE.CONNECTING, PANEL_STATE.BRIDGE_NOT_FOUND, PANEL_STATE.INCOMPATIBLE,
]);

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
      sessionActionKey: status.sessionAction ? `TALKING_TOKENS.SessionAction.${status.sessionAction}` : null,
    },
    voiceSummary: status.state === PANEL_STATE.LISTENING ? summarizeVoice(voiceMembers, mapping, status.channelName) : null,
    isAutoConnectOn,
    setup: {
      isNeeded: Boolean(SETUP_STEP[status.state]) && !PASSING_STATES.has(status.state),
      step: SETUP_STEP[status.state] ?? null,
      canSetToken: !NO_BRIDGE_STATES.has(status.state),
      // Outside their own step, the token field and the account list are rare actions, so they start collapsed.
      isTokenStep: TOKEN_STATES.has(status.state),
      isGmStep: status.state === PANEL_STATE.NO_GM,
      tokenResultKey: tokenResultKey(tokenResult),
      inviteUrl: status.inviteUrl,
      gmCandidates: hasDiscord ? voiceMembers : [],
      hasDiscord,
      guideUrl: SETUP_GUIDE_URL,
    },
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
