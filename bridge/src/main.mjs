import { appendFileSync, unlinkSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import packageJson from "../package.json" with { type: "json" };
import { DEFAULT_BRIDGE_PORT } from "../../module/scripts/protocol.mjs";
import { BridgeController } from "./bridge-controller.mjs";
import { defaultConfigPath } from "./config-path.mjs";
import { ConfigStore } from "./config-store.mjs";
import { ConsoleOutput } from "./console-output.mjs";
import { DiscordSession } from "./discord/discord-session.mjs";
import { VoiceListener } from "./discord/voice-listener.mjs";
import { installCrashHandlers } from "./lifecycle/crash-handler.mjs";
import { probeExistingBridge } from "./lifecycle/existing-bridge.mjs";
import { InstanceLock } from "./lifecycle/instance-lock.mjs";
import { endHungBridge } from "./lifecycle/process-control.mjs";
import { decideStart, START_DECISION } from "./lifecycle/start-decision.mjs";
import { LocalServer } from "./local-server.mjs";
import { isLoopbackOrigin } from "./loopback-origin.mjs";

const output = new ConsoleOutput(process);
const configPath = defaultConfigPath({ platform: process.platform, env: process.env, homeDir: homedir(), join });
const dataFolder = dirname(configPath);

installCrashHandlers({ logPath: join(dataFolder, "bridge.log"), appendFileSync, output });

const configStore = new ConfigStore(configPath, { readFile, writeFile, rename, mkdir, dirname });
const lock = new InstanceLock(join(dataFolder, "bridge.lock"), { readFile, writeFile, mkdir, unlinkSync, dirname });

const server = new LocalServer({
  port: DEFAULT_BRIDGE_PORT,
  isOriginAllowed: isLoopbackOrigin,
  events: {
    onClientConnected: (send) => controller.welcomeMessages().forEach(send),
    onMessage: (message, reply) => controller.handle(message, reply).catch((error) => output.error(error)),
    onInvalidMessage: (error) => output.warn(`Ignored an invalid message from Foundry. ${error}`),
    onRejectedOrigin: (origin) => output.warn(`Refused a connection from ${origin ?? "an unknown origin"}.`),
  },
});

const controller = new BridgeController({
  configStore,
  openSession: (token) => DiscordSession.open(token),
  createVoiceListener: (events) => new VoiceListener(events),
  broadcast: (message) => server.broadcast(message),
  showStatus: (status) => output.status(status),
  bridgeVersion: packageJson.version,
});

process.on("SIGINT", async () => {
  await controller.disconnect();
  server.close();
  process.exit(0);
});

try {
  output.info(`Talking Tokens bridge ${packageJson.version}`);
  const decision = await decideStart({
    port: DEFAULT_BRIDGE_PORT,
    probe: () => probeExistingBridge(DEFAULT_BRIDGE_PORT),
    readLock: () => lock.read(),
    endHungBridge,
    wait,
  });
  if (decision === START_DECISION.ALREADY_RUNNING) {
    output.info("The bridge already runs. This window closes now.");
    process.exit(0);
  }

  await lock.write({ pid: process.pid, executable: process.execPath });
  process.on("exit", () => lock.removeSync());

  output.info(`Config: ${configStore.filePath}`);
  await controller.start();
  await server.start();
  output.info(`Foundry can connect on ws://127.0.0.1:${server.port}`);
} catch (error) {
  output.fatal(error);
}
