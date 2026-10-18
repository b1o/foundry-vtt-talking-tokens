import { layoutIndicator } from "./indicator-layout.mjs";

/**
 * Put an indicator sprite (a child of the token) at its place for the style.
 * @param {PIXI.Sprite} sprite
 * @param {Token} token
 * @param {{anchor: import("./indicator-layout.mjs").Anchor, scale: number}} style
 */
export function layoutSprite(sprite, token, style) {
  const { texture } = sprite;
  const box = layoutIndicator({ width: token.w, height: token.h }, texture.width / texture.height, style);
  sprite.position.set(box.x, box.y);
  sprite.width = box.width;
  sprite.height = box.height;
}
