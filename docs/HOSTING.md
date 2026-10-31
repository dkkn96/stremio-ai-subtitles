# HTTPS and automatic startup

The addon runs on your computer/server. It needs to stay awake and online.
GitHub distributes code; it does not run this service. Use a private instance
with your own accounts, not a public shared subscription relay.

## Temporary HTTPS test

Install `cloudflared` from the [official Cloudflare downloads](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).
Start the addon (`npm start`) and, in a second terminal, run:

```sh
cloudflared tunnel --url http://127.0.0.1:7017
```

It prints a temporary `https://…trycloudflare.com` address. Cloudflare intermediates
this traffic, including subtitles. Use this option only if you agree to that.
Set `PUBLIC_BASE_URL` in your private `.env` to that exact origin (no path), restart
the addon, run `npm run link` and install the resulting HTTPS manifest in Stremio.
Keep both terminals open. The address may change after restart, requiring reinstall.
Temporary tunnels are for tests and have provider limits; they are not permanent hosting.

## Permanent hostname

Prerequisites: a Cloudflare account and a domain you control whose DNS is active
there. A domain may require paid registration; this project does not purchase one.
If migrating an existing domain, preserve current DNS/DNSSEC and other services.
Ask a knowledgeable assistant to prepare the exact transition before changing
nameservers; this guide does not prescribe disabling DNSSEC blindly.

Follow Cloudflare's [locally managed tunnel guide](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/).
Choose an unused subdomain, for example `subtitles.your-domain.example` (replace it
with your actual domain everywhere below). Then:

```sh
cloudflared tunnel login
cloudflared tunnel create stremio-ai-subtitles
```

Complete the browser authorization yourself. The create command prints the tunnel
UUID and the credentials-file path. Keep them local. Create a private YAML file,
for example `runtime/tunnel.yml` inside the project, containing your actual values:

```yaml
tunnel: YOUR-TUNNEL-UUID
credentials-file: /absolute/path/from-the-create-command.json
ingress:
  - hostname: subtitles.your-domain.example
    service: http://127.0.0.1:7017
  - service: http_status:404
```

Do not put this private generated file into Git. Use your configured port if it
is not 7017. In a terminal, route **only the selected unused hostname**:

```sh
cloudflared tunnel route dns stremio-ai-subtitles subtitles.your-domain.example
cloudflared tunnel --config runtime/tunnel.yml ingress validate
cloudflared tunnel --config runtime/tunnel.yml run
```

Set `PUBLIC_BASE_URL=https://subtitles.your-domain.example` in `.env` and restart
the addon. Check `https://subtitles.your-domain.example/health`, then:

```sh
npm run doctor -- --online
npm run link
```

Install the resulting HTTPS link. Test from a phone on mobile data as well as
home Wi-Fi. Do not add a Cloudflare Access login page or interactive challenge
to the addon routes: ordinary Stremio players cannot complete it. Keep the random
addon path private and preserve the existing token to retain the installed link.
You do not need router port forwarding for a tunnel.

## macOS startup after login

First validate the foreground addon and tunnel. Stop their foreground processes
with Control-C before installing services. From the project directory:

```sh
npm run service -- generate
```

This only prepares a private launch-agent file under `runtime/`. To install the
addon service for your current macOS user:

```sh
npm run service -- install
```

It uses the current Node executable, project directory and command search path;
starts after user login; restarts after failure; and uses `caffeinate -is` while
running. It does not disable screen sleep, FileVault, login security or lid sleep.
Keep the Mac connected to power. Node/client paths must remain valid after updates.
macOS may ask to allow the background item. Approve that personally if you want it.

For the permanent tunnel, find the cloudflared executable:

```sh
command -v cloudflared
```

Pass that exact absolute path (replace `/absolute/path/cloudflared` below):

```sh
npm run service -- install --tunnel-config runtime/tunnel.yml --cloudflared /absolute/path/cloudflared
```

The app and tunnel use separate launch agents. Check and remove them separately:

```sh
npm run service -- status
npm run service -- status --tunnel-config runtime/tunnel.yml
npm run service -- remove
npm run service -- remove --tunnel-config runtime/tunnel.yml
```

Removing a service preserves configuration, accounts and cache. It does not delete
the Cloudflare tunnel/DNS. Do not move the project folder or change Node's location
without reinstalling the services. Logs remain private under `runtime/`; rotate or
remove old logs when stopped. No global power setting is changed.

After a real reboot, unlock FileVault and log in. Confirm health and playback
without manually starting Terminal. Then test screen-off and your own lid/external
display arrangement from another device. `caffeinate` is not a general guarantee
that a closed MacBook lid will leave the host available.

## Linux and Windows

The Node core is portable, but new native provider/OS installations are unverified.
Linux can run `npm start` with an appropriate user service after testing; the Mac
service installer intentionally refuses other operating systems. Windows users
should work with their assistant on a WSL deployment and verify the chosen CLI's
native requirements. No untested Windows auto-start installer is claimed here.

## Updates and backups

Stop both services before changing installation paths or upgrading dependencies.
Back up `.env`, `data/` and the private tunnel credentials to secure local storage.
Use the same Node path or reinstall the service. Run the offline tests and an
opt-in provider probe after a client upgrade; pin a working CLI version if needed.
Do not copy dedicated account sessions between different users or operating systems.
