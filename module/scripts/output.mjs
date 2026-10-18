/*
 * All console and notification output of the module goes through this file, so that every line names the module
 * (FOUNDRY_MODULE_RULES.md 7.5).
 */

const PREFIX = "Talking Tokens";

export const log = Object.freeze({
  info: (message, ...details) => console.info(`${PREFIX} | ${message}`, ...details),
  warn: (message, ...details) => console.warn(`${PREFIX} | ${message}`, ...details),
  error: (message, ...details) => console.error(`${PREFIX} | ${message}`, ...details),
});

/** Notifications localize their text key, and start with the module name, because a toast shows no source. */
export const notify = Object.freeze({
  info: (key, data) => ui.notifications.info(`${PREFIX}: ${game.i18n.format(key, data)}`),
  warn: (key, data) => ui.notifications.warn(`${PREFIX}: ${game.i18n.format(key, data)}`),
  error: (key, data) => ui.notifications.error(`${PREFIX}: ${game.i18n.format(key, data)}`),
});
