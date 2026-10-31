# Security and private data

This is an individually hosted private addon, not a hardened multi-tenant public
translation service. Anyone holding its random manifest path can use its quota.
Keep that URL private. Do not place it in public screenshots, issues or URLs sent
to third-party diagnostic sites. TLS is required outside loopback testing.

Keep `.env`, `data`, `runtime`, logs, source URLs and all AI authentication files
out of Git. Account state is managed by the chosen official CLI; the addon does
not parse browser sessions or redistribute credentials. The runtime strips
unrelated inherited API keys from subscription-client processes.

Subtitle dialogue and source responses are untrusted. They cannot select shell
commands, local files, provider URLs, keys or model settings. Source downloads
reject local/private IPs; outputs preserve application-owned timing and cue IDs.
CLI execution limits and tool restrictions are defense in depth, not an OS-level
proof against every client/plugin vulnerability. Use official updated clients
and a dedicated login; do not add unrelated plugins or connectors to that state.

For a vulnerability, use GitHub's private vulnerability reporting if enabled on
the published repository. Otherwise open a minimal issue asking for a private
contact without disclosing an exploit or secret. Never attach actual credentials.

If a manifest token leaks, stop the service, create a new random token locally,
restart, and reinstall the new link on your own devices. Remove the explicit
ADDON_TOKEN setting if using the generated token. Treat an AI credential leak
separately: revoke it through that provider's official account controls.
