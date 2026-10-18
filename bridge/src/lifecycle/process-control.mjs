import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * `tasklist /FO CSV /NH` prints one line per process: "image","pid",... or an INFO line if nothing matches.
 * @returns {string|null} The image name, for example "talking-tokens-bridge.exe".
 */
export function parseTasklistImageName(output) {
  const match = /^"([^"]+)","\d+"/m.exec(output);
  return match ? match[1] : null;
}

async function imageNameOf(pid) {
  if (process.platform === "win32") {
    const { stdout } = await run("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
    return parseTasklistImageName(stdout);
  }
  try {
    const { stdout } = await run("ps", ["-p", String(pid), "-o", "comm="]);
    return basename(stdout.trim()) || null;
  } catch {
    return null; // ps exits with 1 when the process does not exist.
  }
}

/**
 * End the process of a hung bridge. A process id can be reused by another program after a crash, so the process
 * ends only if its image name is the one in the lock file.
 * @param {import("./instance-lock.mjs").LockInfo} lock
 * @returns {Promise<boolean>} True if the process ended or did not exist anymore.
 */
export async function endHungBridge(lock) {
  const imageName = await imageNameOf(lock.pid);
  if (imageName === null) return true;
  if (imageName.toLowerCase() !== basename(lock.executable).toLowerCase()) return false;
  process.kill(lock.pid);
  return true;
}
