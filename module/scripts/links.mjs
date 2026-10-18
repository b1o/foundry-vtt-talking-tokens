/*
 * The web pages that the panel opens. The desktop app opens http(s) links in the default browser.
 * "latest" in a release URL is resolved by GitHub, so these links never need an update.
 */

const REPOSITORY_URL = "https://github.com/b1o/foundry-vtt-talking-tokens";

export const SETUP_GUIDE_URL = `${REPOSITORY_URL}#setup`;

export const TROUBLESHOOTING_URL = `${REPOSITORY_URL}#troubleshooting`;

export const BRIDGE_DOWNLOAD_URL = `${REPOSITORY_URL}/releases/latest/download/talking-tokens-bridge.exe`;
