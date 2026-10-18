/**
 * An error that nobody caught leaves the process in an unknown state. Write it to the log file, show it, and
 * exit, so that a broken bridge never keeps running (and never keeps the port).
 * @param {{logPath: string, appendFileSync: Function, output: import("../console-output.mjs").ConsoleOutput}} deps
 */
export function installCrashHandlers({ logPath, appendFileSync, output }) {
  const onCrash = (error) => {
    try {
      appendFileSync(logPath, `${new Date().toISOString()} ${error?.stack ?? error}\n`, "utf8");
    } catch (logError) {
      output.error(logError); // The log is a help, not a must; the error itself still shows below.
    }
    output.fatal(error instanceof Error ? error : new Error(String(error)));
  };
  process.on("uncaughtException", onCrash);
  process.on("unhandledRejection", onCrash);
}
