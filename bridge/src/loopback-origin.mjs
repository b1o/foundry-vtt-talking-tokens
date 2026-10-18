const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Browsers always send the Origin header on a WebSocket handshake. Only a Foundry page that the GM opened through
 * localhost may control the bridge; any other web site in the same browser must not.
 * @param {string|undefined} origin  The Origin header of the handshake.
 */
export function isLoopbackOrigin(origin) {
  if (!origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return (url.protocol === "http:" || url.protocol === "https:") && LOOPBACK_HOSTNAMES.has(url.hostname);
}
