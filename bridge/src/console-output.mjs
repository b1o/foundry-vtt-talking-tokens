import { BRIDGE_STATE } from "../../module/scripts/protocol.mjs";

const STATUS_TEXT = {
  [BRIDGE_STATE.NO_TOKEN]: () => "Waiting for setup. Open the Talking Tokens panel in Foundry and paste your bot token.",
  [BRIDGE_STATE.IDLE]: () => "Ready. Connect from the Talking Tokens panel in Foundry.",
  [BRIDGE_STATE.LOGGING_IN]: () => "Logging in to Discord…",
  [BRIDGE_STATE.TOKEN_REJECTED]: () => "Discord rejected the bot token. Paste a new token in Foundry.",
  [BRIDGE_STATE.DISCORD_UNREACHABLE]: () => "Discord cannot be reached. Check your internet connection.",
  [BRIDGE_STATE.NO_SERVER]: (status) => `The bot is in no Discord server. Invite it: ${status.inviteUrl}`,
  [BRIDGE_STATE.NO_GM]: () => "Join a voice channel, then select your own name in Foundry.",
  [BRIDGE_STATE.GM_NOT_IN_VOICE]: () => "Waiting for the GM to join a voice channel.",
  [BRIDGE_STATE.MISSING_PERMISSION]: (status) => `The bot cannot join #${status.channelName}. Give it the Connect permission.`,
  [BRIDGE_STATE.JOINING]: (status) => `Joining #${status.channelName}…`,
  [BRIDGE_STATE.LISTENING]: (status) => `Listening in #${status.channelName}.`,
};

/** The console window of the bridge. The user only reads it; all setup happens in Foundry. */
export class ConsoleOutput {
  #stdout;
  #stderr;
  #stdin;
  #exit;

  /** @param {{stdout: NodeJS.WriteStream, stderr: NodeJS.WriteStream, stdin: NodeJS.ReadStream, exit: (code: number) => void}} terminal */
  constructor({ stdout, stderr, stdin, exit }) {
    this.#stdout = stdout;
    this.#stderr = stderr;
    this.#stdin = stdin;
    this.#exit = exit;
  }

  info(text) {
    this.#stdout.write(`${text}\n`);
  }

  warn(text) {
    this.#stderr.write(`Warning: ${text}\n`);
  }

  /** An unexpected error that does not stop the bridge. */
  error(error) {
    this.#stderr.write(`ERROR: ${error.stack ?? error}\n`);
  }

  /** @param {{state: string}} status  A status message of protocol.mjs. */
  status(status) {
    this.info(STATUS_TEXT[status.state](status));
  }

  /**
   * A double-clicked executable gets its own console window, and Windows closes it when the process exits.
   * So the window waits for Enter, and the user can read the error first.
   */
  fatal(error) {
    this.#stderr.write(`\nERROR: ${error.message}\n`);
    if (error.cause) this.#stderr.write(`${error.cause.stack ?? error.cause}\n`);
    if (!this.#stdin.isTTY) {
      this.#exit(1);
      return;
    }
    this.#stderr.write("\nPress Enter to close this window.\n");
    this.#stdin.once("data", () => this.#exit(1));
  }
}
