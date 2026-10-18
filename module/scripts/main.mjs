import { BridgeClient } from "./bridge/bridge-client.mjs";
import { BridgeLink } from "./bridge/bridge-link.mjs";
import { describeConnection, isLoopbackHostname } from "./bridge/connection-status.mjs";
import { StatusHistory } from "./bridge/status-history.mjs";
import { assignDiscordId } from "./mapping/user-mapping.mjs";
import { MODULE_ID } from "./module-id.mjs";
import { bridgeUrl } from "./protocol.mjs";
import {
  addLibraryBubble, getDefaultBubbleId, getHoldTimeMs, getIndicatorScale, getUserMapping, isAutoConnectOn,
  registerSettings, removeLibraryBubble, SCALE_RANGE, setAutoConnect, setDefaultBubbleId, setIndicatorAnchor,
  setIndicatorScale, updateUserMapping,
} from "./settings.mjs";
import { SpeakingRelay } from "./speaking/speaking-relay.mjs";
import { SpeakingState } from "./speaking/speaking-state.mjs";
import { ANCHOR_PRESETS } from "./tokens/indicator-layout.mjs";
import { IndicatorStyle } from "./tokens/indicator-style.mjs";
import { PlacementMode } from "./tokens/placement-mode.mjs";
import { addSpeakerButton } from "./tokens/speaker-hud-button.mjs";
import { registerSpeakerHotkey } from "./tokens/speaker-hotkey.mjs";
import { findSceneSpeakerTokenNames, hasModuleFlagChange, hasTokenBubbleChange } from "./tokens/token-flags.mjs";
import { TokenIndicators } from "./tokens/token-indicators.mjs";
import { addControlButton, showStatusOnControlButton } from "./ui/control-button.mjs";
import { ControlPanel } from "./ui/control-panel.mjs";
import { copyDiagnostics } from "./ui/copy-diagnostics.mjs";
import { buildPanelView } from "./ui/panel-view.mjs";
import { TokenBubbleWindows } from "./ui/token-bubble-window.mjs";
import { addBubbleHeaderButton, addBubbleHeaderControl } from "./ui/token-config-button.mjs";

const timers = { setTimeout: (...args) => window.setTimeout(...args), clearTimeout: (id) => window.clearTimeout(id) };
const isLocalhost = isLoopbackHostname(window.location.hostname);

const indicatorStyle = new IndicatorStyle();
const indicators = new TokenIndicators({ getSpeakingUserIds: () => speakingState.speakingUserIds, style: indicatorStyle });

const speakingState = new SpeakingState({
  getHoldTimeMs,
  timers,
  onChange: () => {
    indicators.syncAll();
    panel.showSpeaking(speakingState.speakingUserIds);
  },
});

const relay = new SpeakingRelay({
  socket: { emit: (...args) => game.socket.emit(...args), on: (...args) => game.socket.on(...args) },
  isActiveGm: () => game.user === game.users.activeGM,
  getActiveGmId: () => game.users.activeGM?.id ?? null,
  getUserMapping,
  onSpeakingUsers: (userIds) => speakingState.setSpeakingUsers(userIds),
  timers,
});

const statusHistory = new StatusHistory({ now: () => new Date() });

const link = new BridgeLink({
  createClient: (events) => new BridgeClient({
    url: bridgeUrl(),
    createWebSocket: (url) => new WebSocket(url),
    timers,
    events,
  }),
  isAutoConnectOn,
  events: {
    onChange: () => {
      statusHistory.record(currentStatus());
      panel.refresh();
      if (ui.controls?.element) showConnectionOnControls(ui.controls.element);
    },
    onSpeakingSnapshot: (discordIds) => relay.onBridgeSnapshot(discordIds),
    onSpeaking: (discordId, speaking) => relay.onBridgeSpeaking(discordId, speaking),
  },
});

const placement = new PlacementMode({
  getTexture: (token) => indicators.waitForTexture(token),
  style: indicatorStyle,
  onChange: () => panel.refresh(),
});

const currentStatus = () => describeConnection(link.facts, {
  isLocalhost, moduleVersion: game.modules.get(MODULE_ID).version,
});

const showConnectionOnControls = (html) => showStatusOnControlButton(html, currentStatus());

const bubbleWindows = new TokenBubbleWindows({
  getLibrary: () => indicatorStyle.library,
  getDefaultBubbleId,
});

const linkUser = (userId, discordId) => updateUserMapping((mapping) => assignDiscordId(mapping, userId, discordId));

const panel = new ControlPanel({
  getView: () => buildPanelView({
    status: currentStatus(),
    voiceMembers: link.facts.voiceMembers,
    users: game.users.map((user) => ({
      id: user.id, name: user.name, isGM: user.isGM, speakerTokenNames: findSceneSpeakerTokenNames(canvas.scene, user),
    })),
    mapping: getUserMapping(),
    speakingUserIds: speakingState.speakingUserIds,
    tokenResult: link.facts.tokenResult,
    placement: { isActive: placement.isActive, tokenName: placement.tokenName },
    isAutoConnectOn: isAutoConnectOn(),
    bubbles: {
      library: indicatorStyle.library, defaultBubbleId: getDefaultBubbleId(), scale: getIndicatorScale(),
      scaleRange: SCALE_RANGE,
    },
    currentUserId: game.user.id,
  }),
  commands: {
    connect: () => link.connectDiscord(),
    disconnect: () => link.disconnectDiscord(),
    setToken: (token) => link.setToken(token),
    // The GM's own Discord account also maps to the GM's Foundry user, so the GM's voice can show on a marked NPC.
    setGm: (discordId) => {
      link.setGm(discordId);
      linkUser(game.user.id, discordId);
    },
    linkUser,
    setAutoConnect,
    applyPreset: (presetName) => setIndicatorAnchor(ANCHOR_PRESETS[presetName]),
    startPlacement: () => placement.startOnSelectedToken(),
    savePlacement: () => {
      const anchor = placement.finish();
      if (anchor) setIndicatorAnchor(anchor);
    },
    cancelPlacement: () => placement.cancel(),
    setDefaultBubble: setDefaultBubbleId,
    addBubble: addLibraryBubble,
    removeBubble: removeLibraryBubble,
    previewScale: (scale) => {
      indicatorStyle.previewScale(scale);
      indicators.relayoutAll();
      placement.relayout();
    },
    // The settings change rebuilds the indicators with the saved size.
    saveScale: (scale) => {
      indicatorStyle.endPreview();
      setIndicatorScale(scale);
    },
    testUser: (userId) => relay.startTest(userId),
    copyDiagnostics: () => copyDiagnostics({
      facts: link.facts, status: currentStatus(), history: statusHistory.entries,
      mapping: getUserMapping(),
    }),
  },
});

Hooks.once("init", () => {
  registerSettings({
    onIndicatorChange: () => {
      indicators.rebuildAll();
      placement.relayout();
      panel.refresh();
      bubbleWindows.refreshAll();
    },
    onMappingChange: () => {
      relay.republish();
      panel.refresh();
    },
  });
  registerSpeakerHotkey();
});

Hooks.once("ready", () => {
  relay.listen();
  if (game.user.isGM && isLocalhost) link.start();
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) addControlButton(controls, () => panel.render(true));
});
Hooks.on("renderSceneControls", (_app, html) => game.user.isGM && showConnectionOnControls(html));

Hooks.on("renderTokenHUD", addSpeakerButton);

Hooks.on("canvasReady", () => {
  indicators.rebuildAll();
  panel.refresh();
});
Hooks.on("canvasTearDown", () => {
  placement.cancel();
  indicators.clear();
});
Hooks.on("drawToken", (token) => {
  placement.onTokenGone(token);
  indicators.syncToken(token);
});
Hooks.on("refreshToken", (token, flags) => flags.refreshSize && indicators.relayoutToken(token));
Hooks.on("destroyToken", (token) => {
  placement.onTokenGone(token);
  indicators.forgetToken(token);
});

// Ownership, the assigned character, the actor of a token, and the speaker marks decide which token speaks.
const onSpeakerFactsChange = () => {
  indicators.syncAll();
  panel.refresh();
};
Hooks.on("updateActor", (_actor, change) => "ownership" in change && onSpeakerFactsChange());
Hooks.on("updateUser", (_user, change) => "character" in change && onSpeakerFactsChange());
Hooks.on("updateToken", (_token, change) => ("actorId" in change || hasModuleFlagChange(change)) && onSpeakerFactsChange());
Hooks.on("updateToken", (tokenDocument, change) => {
  if (!hasTokenBubbleChange(change)) return;
  if (tokenDocument.object) indicators.redrawToken(tokenDocument.object);
  bubbleWindows.refreshToken(tokenDocument);
});
Hooks.on("deleteToken", (tokenDocument) => bubbleWindows.closeToken(tokenDocument));

// The "Bubble" button in the Token Config header: v11 (Application V1) and v13 (ApplicationV2).
Hooks.on("getTokenConfigHeaderButtons", (sheet, buttons) => {
  addBubbleHeaderButton(sheet, buttons, (tokenDocument) => bubbleWindows.open(tokenDocument));
});
Hooks.on("getHeaderControlsTokenConfig", (sheet, controls) => {
  addBubbleHeaderControl(sheet, controls, (tokenDocument) => bubbleWindows.open(tokenDocument));
});

// The panel lists every player.
Hooks.on("createUser", () => panel.refresh());
Hooks.on("deleteUser", () => panel.refresh());

// A player who joins late gets the current list at once.
Hooks.on("userConnected", () => relay.republish());
