import { getSceneControlTool } from "../compat.mjs";

const TOOL_NAME = "talking-tokens";

/**
 * The GM's button in the token controls that opens the panel.
 * @param {object[]} controls  The argument of the getSceneControlButtons hook.
 */
export function addControlButton(controls, onClick) {
  controls.find((control) => control.name === "token")?.tools.push({
    name: TOOL_NAME,
    title: "TALKING_TOKENS.Controls.OpenPanel",
    icon: "fas fa-comment-dots",
    button: true,
    onClick,
  });
}

/**
 * Color the button with the tone of the connection, and put the status text into its tooltip, so the color is not
 * the only signal. The scene controls render again on each tool change, so call this on renderSceneControls too.
 * @param {HTMLElement|jQuery} html  The scene controls.
 * @param {import("../bridge/connection-status.mjs").ConnectionStatus} status
 */
export function showStatusOnControlButton(html, status) {
  const tool = getSceneControlTool(html, TOOL_NAME);
  if (!tool) return;
  const text = game.i18n.format(`TALKING_TOKENS.Status.${status.state}`, { channel: status.channelName });
  const label = game.i18n.format("TALKING_TOKENS.Controls.Status", { status: text });
  tool.dataset.ttTone = status.tone;
  tool.dataset.tooltip = label;
  tool.setAttribute("aria-label", label);
}
