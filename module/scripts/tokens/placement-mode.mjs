import { notify } from "../output.mjs";
import { getIndicatorStyle } from "../settings.mjs";
import { anchorFromPoint } from "./indicator-layout.mjs";
import { layoutSprite } from "./indicator-sprite.mjs";

const PREVIEW_ALPHA = 0.85;

/**
 * The GM drags a preview bubble on one token; the panel offers Save and Cancel. Enter and Esc are not used, because
 * core already uses Esc to close windows and the HUD.
 */
export class PlacementMode {
  #getTexture;
  #onChange;
  #token = null;
  #preview = null;
  #anchor = null;

  /**
   * @param {{getTexture: (token: Token) => Promise<PIXI.Texture|null>, onChange: () => void}} options
   *   getTexture waits for the load; onChange: placement started or ended.
   */
  constructor({ getTexture, onChange }) {
    this.#getTexture = getTexture;
    this.#onChange = onChange;
  }

  get isActive() {
    return this.#token !== null;
  }

  get tokenName() {
    return this.#token?.name ?? null;
  }

  /** Start on the token that the GM selected on the canvas. */
  async startOnSelectedToken() {
    const token = canvas.tokens?.controlled[0];
    if (!token) {
      notify.info("TALKING_TOKENS.Panel.SelectTokenFirst");
      return;
    }
    const texture = await this.#getTexture(token);
    // Null only if the custom image and the classic bubble both failed; core and the indicators report the error.
    if (!texture || token.destroyed) return;
    this.#start(token, texture);
  }

  #start(token, texture) {
    this.cancel();
    this.#token = token;
    this.#anchor = getIndicatorStyle().anchor;
    this.#preview = this.#createPreview(token, texture);
    this.#layout();
    this.#onChange();
  }

  /** @returns {import("./indicator-layout.mjs").Anchor|null} The anchor to save, or null if not active. */
  finish() {
    const anchor = this.#anchor;
    this.cancel();
    return anchor;
  }

  cancel() {
    if (!this.isActive) return;
    const frame = this.#preview.parent;
    if (!frame.destroyed) frame.destroy({ children: true });
    this.#token = null;
    this.#preview = null;
    this.#anchor = null;
    this.#onChange();
  }

  /** The frame stands at the token's position when the placement starts, so a redraw or a deletion ends it. */
  onTokenGone(token) {
    if (token === this.#token) this.cancel();
  }

  /**
   * The preview is not a child of the token: the token has a hitArea, and PIXI does not hit-test the children of a
   * container outside its hitArea, so a bubble outside the token could not be dragged. A frame on the token layer
   * at the token's position keeps the token-local layout.
   */
  #createPreview(token, texture) {
    const frame = new PIXI.Container();
    frame.position.copyFrom(token.position);
    const preview = frame.addChild(new PIXI.Sprite(texture));
    preview.alpha = PREVIEW_ALPHA;
    preview.eventMode = "static";
    preview.cursor = "grab";
    let isDragging = false;
    preview.on("pointerdown", (event) => {
      // Without this, the event bubbles to the layer, and core starts a box selection.
      event.stopPropagation();
      isDragging = true;
      preview.cursor = "grabbing";
    });
    preview.on("globalpointermove", (event) => {
      if (!isDragging) return;
      this.#anchor = anchorFromPoint({ width: token.w, height: token.h }, token.toLocal(event.global));
      this.#layout();
    });
    const endDrag = () => {
      isDragging = false;
      preview.cursor = "grab";
    };
    preview.on("pointerup", endDrag);
    preview.on("pointerupoutside", endDrag);
    canvas.tokens.addChild(frame);
    return preview;
  }

  #layout() {
    layoutSprite(this.#preview, this.#token, { ...getIndicatorStyle(), anchor: this.#anchor });
  }
}
