import { TEMPLATE_PATH } from "../module-id.mjs";

/**
 * The partial that draws one library bubble as a button (the panel library and the bubble window). The templates
 * name it by this path, because a Handlebars partial name cannot come from code.
 */
export const BUBBLE_TILE_PARTIAL = `${TEMPLATE_PATH}/bubble-tile.hbs`;

/**
 * The data of one tile for templates/bubble-tile.hbs. A shipped bubble has a text key, an added image its file name.
 * @param {import("../tokens/bubble-library.mjs").Bubble} bubble
 * @param {boolean} isChosen  Is this the bubble in use?
 */
export function toBubbleTile(bubble, isChosen) {
  return {
    id: bubble.id,
    path: bubble.path,
    ...(bubble.isShipped ? { labelKey: bubble.name } : { label: bubble.name }),
    isChosen,
  };
}
