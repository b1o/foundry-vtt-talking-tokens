import { PANEL_STATE } from "../bridge/connection-status.mjs";
import { ANCHOR_PRESETS } from "../tokens/indicator-layout.mjs";

/** In these states the setup section opens by itself, because the GM must act there. */
const SETUP_STATES = new Set([PANEL_STATE.NO_TOKEN, PANEL_STATE.TOKEN_REJECTED, PANEL_STATE.NO_GM]);

/** Only these states have a Discord session, so only they can list voice members. */
const DISCORD_STATES = new Set([
  PANEL_STATE.NO_SERVER, PANEL_STATE.NO_GM, PANEL_STATE.GM_NOT_IN_VOICE, PANEL_STATE.MISSING_PERMISSION,
  PANEL_STATE.JOINING, PANEL_STATE.LISTENING,
]);

/**
 * @typedef {object} PanelInput
 * @property {import("../bridge/connection-status.mjs").ConnectionStatus} status
 * @property {import("../protocol.mjs").VoiceMember[]} voiceMembers
 * @property {{id: string, name: string, isGM: boolean, speakerTokenNames: string[]}[]} users
 * @property {import("../mapping/user-mapping.mjs").UserMapping} mapping
 * @property {string[]} speakingUserIds
 * @property {{accepted: boolean, error: string|null}|null} tokenResult  The reply to the last token that the GM sent.
 * @property {{isActive: boolean, tokenName: string|null}} placement
 * @property {boolean} isAutoConnectOn
 */

/**
 * The data for templates/control-panel.hbs. Text keys are resolved in the template.
 * @param {PanelInput} input
 */
export function buildPanelView(input) {
  const { status, voiceMembers, users, mapping, speakingUserIds, tokenResult, placement, isAutoConnectOn } = input;
  const speaking = new Set(speakingUserIds);
  const hasDiscord = DISCORD_STATES.has(status.state);
  return {
    status: {
      ...status,
      textKey: `TALKING_TOKENS.Status.${status.state}`,
      actionKey: status.action ? `TALKING_TOKENS.Action.${status.action}` : null,
    },
    isSetupOpen: SETUP_STATES.has(status.state),
    canSetToken: status.state !== PANEL_STATE.NOT_LOCALHOST && status.state !== PANEL_STATE.BRIDGE_NOT_FOUND,
    tokenResultKey: tokenResultKey(tokenResult),
    inviteUrl: status.inviteUrl,
    gmCandidates: hasDiscord ? voiceMembers : [],
    hasDiscord,
    isAutoConnectOn,
    placement,
    presets: Object.keys(ANCHOR_PRESETS).map((name) => ({ name, labelKey: `TALKING_TOKENS.Preset.${name}` })),
    players: users.filter((user) => !user.isGM).map((user) => ({
      id: user.id,
      name: user.name,
      isSpeaking: speaking.has(user.id),
      speakerTokenNames: user.speakerTokenNames.join(", "),
      options: memberOptions(voiceMembers, mapping[user.id] ?? null),
    })),
  };
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
