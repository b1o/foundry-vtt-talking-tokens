// Discord permission bits: View Channels (1 << 10) and Connect (1 << 20). The bot needs nothing else, because it
// only listens and never speaks or writes.
const REQUIRED_PERMISSIONS = (1n << 10n) | (1n << 20n);

export function buildInviteUrl(applicationId) {
  const query = new URLSearchParams({
    client_id: applicationId,
    scope: "bot",
    permissions: REQUIRED_PERMISSIONS.toString(),
  });
  return `https://discord.com/oauth2/authorize?${query}`;
}
