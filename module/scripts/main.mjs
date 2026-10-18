import { BridgeClient } from "./bridge/bridge-client.mjs";
import { BridgeLink } from "./bridge/bridge-link.mjs";
import { describeConnection, isLoopbackHostname } from "./bridge/connection-status.mjs";
import { assignDiscordId } from "./mapping/user-mapping.mjs";
import { bridgeUrl } from "./protocol.mjs";
import {
  getHoldTimeMs, getUserMapping, isAutoConnectOn, registerSettings, setAutoConnect, setIndicatorAnchor,
  updateUserMapping,
} from "./settings.mjs";
import { SpeakingRelay } from "./speaking/speaking-relay.mjs";
import { SpeakingState } from "./speaking/speaking-state.mjs";
import { ANCHOR_PRESETS } from "./tokens/indicator-layout.mjs";
import { PlacementMode } from "./tokens/placement-mode.mjs";
import { addSpeakerButton } from "./tokens/speaker-hud-button.mjs";
import { registerSpeakerHotkey } from "./tokens/speaker-hotkey.mjs";
import { findSceneSpeakerTokenNames, hasModuleFlagChange } from "./tokens/token-flags.mjs";
import { TokenIndicators } from "./tokens/token-indicators.mjs";
import { addControlButton, showStatusOnControlButton } from "./ui/control-button.mjs";
import { ControlPanel } from "./ui/control-panel.mjs";
import { buildPanelView } from "./ui/panel-view.mjs";

const timers = { setTimeout: (...args) => window.setTimeout(...args), clearTimeout: (id) => window.clearTimeout(id) };
const isLocalhost = isLoopbackHostname(window.location.hostname);

const indicators = new TokenIndicators({ getSpeakingUserIds: () => speakingState.speakingUserIds });

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
});

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
      panel.refresh();
      if (ui.controls?.element) showConnectionOnControls(ui.controls.element);
    },
    onSpeakingSnapshot: (discordIds) => relay.onBridgeSnapshot(discordIds),
    onSpeaking: (discordId, speaking) => relay.onBridgeSpeaking(discordId, speaking),
  },
});

const placement = new PlacementMode({
  getTexture: (token) => indicators.waitForTexture(token),
  onChange: () => panel.refresh(),
});

const showConnectionOnControls = (html) => showStatusOnControlButton(html, describeConnection(link.facts, isLocalhost));

const linkUser = (userId, discordId) => updateUserMapping((mapping) => assignDiscordId(mapping, userId, discordId));

const panel = new ControlPanel({
  getView: () => buildPanelView({
    status: describeConnection(link.facts, isLocalhost),
    voiceMembers: link.facts.voiceMembers,
    users: game.users.map((user) => ({
      id: user.id, name: user.name, isGM: user.isGM, speakerTokenNames: findSceneSpeakerTokenNames(canvas.scene, user),
    })),
    mapping: getUserMapping(),
    speakingUserIds: speakingState.speakingUserIds,
    tokenResult: link.facts.tokenResult,
    placement: { isActive: placement.isActive, tokenName: placement.tokenName },
    isAutoConnectOn: isAutoConnectOn(),
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
  },
});

Hooks.once("init", () => {
  registerSettings({
    onIndicatorChange: () => indicators.rebuildAll(),
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

// The panel lists every player.
Hooks.on("createUser", () => panel.refresh());
Hooks.on("deleteUser", () => panel.refresh());

// A player who joins late gets the current list at once.
Hooks.on("userConnected", () => relay.republish());
