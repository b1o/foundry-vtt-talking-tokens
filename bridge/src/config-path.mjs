const APP_FOLDER = "talking-tokens-bridge";
const FILE_NAME = "config.json";

/**
 * The config lives in the user profile, not next to the executable, so it survives an update or a move of the
 * executable.
 * @param {{platform: string, env: Record<string, string|undefined>, homeDir: string, join: (...parts: string[]) => string}} system
 */
export function defaultConfigPath({ platform, env, homeDir, join }) {
  if (platform === "win32") return join(env.APPDATA ?? join(homeDir, "AppData", "Roaming"), APP_FOLDER, FILE_NAME);
  if (platform === "darwin") return join(homeDir, "Library", "Application Support", APP_FOLDER, FILE_NAME);
  return join(env.XDG_CONFIG_HOME ?? join(homeDir, ".config"), APP_FOLDER, FILE_NAME);
}
