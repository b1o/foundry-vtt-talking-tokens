import { isDiscordId } from "../../module/scripts/protocol.mjs";

/**
 * @typedef {object} BridgeConfig
 * @property {string|null} token        The Discord bot token. It never leaves this file except to Discord.
 * @property {string|null} gmDiscordId
 */

const EMPTY_CONFIG = Object.freeze({ token: null, gmDiscordId: null });

export class ConfigFileError extends Error {
  constructor(filePath, cause) {
    super(`The config file is damaged: ${filePath}. Delete it, and set up the bridge again in Foundry.`, { cause });
    this.filePath = filePath;
  }
}

/** Reads and writes the bridge config. Writes run one after the other, and each one merges into the file as it is. */
export class ConfigStore {
  #filePath;
  #fileSystem;
  #lastWrite = Promise.resolve();

  /**
   * @param {string} filePath
   * @param {{readFile: Function, writeFile: Function, rename: Function, mkdir: Function, dirname: Function}} fileSystem
   *   The promise-based fs functions, plus path.dirname.
   */
  constructor(filePath, fileSystem) {
    this.#filePath = filePath;
    this.#fileSystem = fileSystem;
  }

  get filePath() {
    return this.#filePath;
  }

  /** @returns {Promise<BridgeConfig>} */
  async load() {
    let text;
    try {
      text = await this.#fileSystem.readFile(this.#filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return { ...EMPTY_CONFIG };
      throw error;
    }
    return this.#parse(text);
  }

  /**
   * @param {Partial<BridgeConfig>} changes
   * @returns {Promise<BridgeConfig>} The config after the write.
   */
  update(changes) {
    const write = this.#lastWrite.then(() => this.#merge(changes));
    // A failed write must not block the next one; the caller of the failed write receives the error.
    this.#lastWrite = write.catch(() => undefined);
    return write;
  }

  async #merge(changes) {
    const config = { ...(await this.load()), ...changes };
    const { writeFile, rename, mkdir, dirname } = this.#fileSystem;
    // Write to a temporary file first, so that a crash during the write cannot leave a half-written config.
    const temporaryPath = `${this.#filePath}.tmp`;
    await mkdir(dirname(this.#filePath), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.#filePath);
    return config;
  }

  #parse(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new ConfigFileError(this.#filePath, error);
    }
    const token = typeof data?.token === "string" && data.token ? data.token : null;
    const gmDiscordId = isDiscordId(data?.gmDiscordId) ? data.gmDiscordId : null;
    return { token, gmDiscordId };
  }
}
