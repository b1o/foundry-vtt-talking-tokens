/**
 * The lock file names the process that runs the bridge now, so that a new bridge can end a hung one.
 * @typedef {{pid: number, executable: string}} LockInfo
 */
export class InstanceLock {
  #filePath;
  #fileSystem;

  /**
   * @param {string} filePath
   * @param {{readFile: Function, writeFile: Function, mkdir: Function, unlinkSync: Function, dirname: Function}} fileSystem
   */
  constructor(filePath, fileSystem) {
    this.#filePath = filePath;
    this.#fileSystem = fileSystem;
  }

  /** @returns {Promise<LockInfo|null>} */
  async read() {
    let text;
    try {
      text = await this.#fileSystem.readFile(this.#filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    try {
      const data = JSON.parse(text);
      return Number.isInteger(data?.pid) && typeof data.executable === "string" ? data : null;
    } catch {
      return null; // A damaged lock names no process, so there is nothing to end.
    }
  }

  /** @param {LockInfo} info */
  async write(info) {
    await this.#fileSystem.mkdir(this.#fileSystem.dirname(this.#filePath), { recursive: true });
    await this.#fileSystem.writeFile(this.#filePath, JSON.stringify(info), "utf8");
  }

  /** Synchronous, because it runs in the "exit" event, where async work does not finish. */
  removeSync() {
    try {
      this.#fileSystem.unlinkSync(this.#filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}
