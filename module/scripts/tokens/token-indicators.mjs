import { loadTextureCompat } from "../compat.mjs";
import { notify } from "../output.mjs";
import { areIndicatorsShown } from "../settings.mjs";
import { FALLBACK_BUBBLE_PATH as FALLBACK_PATH } from "./bubble-library.mjs";
import { layoutSprite } from "./indicator-sprite.mjs";
import { findSceneSpeakerTokenIds } from "./token-flags.mjs";

/**
 * The indicators on the tokens of the viewed scene. Each indicator is a sprite child of its token, so it moves with
 * the token, and it is hidden when the token is not visible to this user.
 *
 * Token#draw destroys all children of the token (PlaceableObject#clear in v11), so the drawToken hook must call
 * syncToken again.
 */
export class TokenIndicators {
  #getSpeakingUserIds;
  #style;
  /** @type {Map<Token, PIXI.Sprite>} */
  #sprites = new Map();
  /** @type {Map<string, PIXI.Texture|null>} null: the load failed. */
  #textures = new Map();
  /** @type {Map<string, Promise<void>>} */
  #loads = new Map();

  /** @param {{getSpeakingUserIds: () => string[], style: import("./indicator-style.mjs").IndicatorStyle}} options */
  constructor({ getSpeakingUserIds, style }) {
    this.#getSpeakingUserIds = getSpeakingUserIds;
    this.#style = style;
  }

  /** After a settings change or a new scene: forget the textures, and draw every indicator again. */
  rebuildAll() {
    this.clear();
    this.#textures.clear();
    this.syncAll();
  }

  syncAll() {
    const speakingTokenIds = this.#speakingTokenIds();
    for (const token of canvas.tokens?.placeables ?? []) this.#sync(token, speakingTokenIds);
  }

  syncToken(token) {
    this.#sync(token, this.#speakingTokenIds());
  }

  /** After a size change of the token. */
  relayoutToken(token) {
    const sprite = this.#sprites.get(token);
    if (sprite && !sprite.destroyed) layoutSprite(sprite, token, this.#style.layout);
  }

  /** While the GM previews a size. */
  relayoutAll() {
    for (const token of this.#sprites.keys()) this.relayoutToken(token);
  }

  /** After a change of the token's own bubble: a shown sprite keeps its texture, so draw it again. */
  redrawToken(token) {
    this.#hide(token);
    this.syncToken(token);
  }

  /** After a change of an actor's own bubble: its tokens on this scene, linked or not. */
  redrawActorTokens(actorId) {
    for (const token of canvas.tokens?.placeables ?? []) {
      if (token.document.actorId === actorId) this.redrawToken(token);
    }
  }

  forgetToken(token) {
    this.#hide(token);
  }

  clear() {
    for (const token of [...this.#sprites.keys()]) this.#hide(token);
  }

  /** @returns {PIXI.Texture|null} The texture that this token uses, or null while it loads. */
  textureFor(token) {
    const path = this.#pathFor(token);
    if (!this.#textures.has(path)) return this.#cachedTexture(path);
    // Loaded or failed: a failed image uses the classic bubble.
    return this.#textures.get(path) ?? this.#cachedTexture(FALLBACK_PATH);
  }

  /** @returns {Promise<PIXI.Texture|null>} The texture of this token, after its load (and the fallback load) ends. */
  async waitForTexture(token) {
    const path = this.#pathFor(token);
    if (!this.#textures.has(path)) await this.#load(path);
    if (!this.#textures.get(path) && !this.#textures.has(FALLBACK_PATH)) await this.#load(FALLBACK_PATH);
    return this.textureFor(token);
  }

  #sync(token, speakingTokenIds) {
    if (areIndicatorsShown() && speakingTokenIds.has(token.id)) this.#show(token);
    else this.#hide(token);
  }

  #speakingTokenIds() {
    const scene = canvas.scene;
    const ids = new Set();
    if (!scene) return ids;
    for (const userId of this.#getSpeakingUserIds()) {
      const user = game.users.get(userId);
      if (!user) continue;
      for (const id of findSceneSpeakerTokenIds(scene, user)) ids.add(id);
    }
    return ids;
  }

  #show(token) {
    const existing = this.#sprites.get(token);
    if (existing && !existing.destroyed) return;
    const texture = this.textureFor(token);
    if (!texture) return; // #load calls syncAll when the texture is ready.
    const sprite = new PIXI.Sprite(texture);
    token.addChild(sprite);
    this.#sprites.set(token, sprite);
    layoutSprite(sprite, token, this.#style.layout);
  }

  #hide(token) {
    const sprite = this.#sprites.get(token);
    this.#sprites.delete(token);
    if (sprite && !sprite.destroyed) sprite.destroy();
  }

  #pathFor(token) {
    return this.#style.bubblePathFor(token.document);
  }

  #cachedTexture(path) {
    if (this.#textures.has(path)) return this.#textures.get(path);
    this.#load(path);
    return null;
  }

  /** One load per path: a second request while it loads waits for the same promise. */
  #load(path) {
    if (!this.#loads.has(path)) this.#loads.set(path, this.#loadOnce(path));
    return this.#loads.get(path);
  }

  /** Core logs a load error itself and returns null; then the classic bubble is used. */
  async #loadOnce(path) {
    const texture = await loadTextureCompat(path);
    this.#loads.delete(path);
    this.#textures.set(path, texture);
    if (!texture) notify.warn("TALKING_TOKENS.Notifications.ImageFailed", { path });
    this.syncAll();
  }
}
