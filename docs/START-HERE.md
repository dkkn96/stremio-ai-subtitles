# Install your own Stremio AI Subtitles

This guide starts from an empty Mac. macOS is the first installation target.
Linux foreground operation has the same commands but has not yet been qualified
on a real installation. Native Windows and Windows auto-start are not qualified;
use the AI-assistant guide to plan a WSL installation, not the Mac service command.

## 1. Prepare the computer

You need Stremio, an account for your chosen AI, and a computer that can stay
awake and connected during playback. The first path below uses Codex with your
own eligible ChatGPT plan. Other choices are in [PROVIDERS.md](PROVIDERS.md).

Install a current LTS Node.js from [nodejs.org](https://nodejs.org/en/download).
The project requires Node 22.12 or newer. Open Terminal (Applications → Utilities)
and run one command at a time:

```sh
node --version
npm --version
```

Both should print a version. If either says “command not found”, close and reopen
Terminal after installing Node. Do not proceed until both work.

## 2. Download the addon

On this repository's GitHub page choose **Code → Download ZIP**, then extract it.
Keep the extracted folder in a stable location, for example Documents. Moving it
later requires reinstalling the optional startup service.

In Terminal type `cd ` (including the space), drag the extracted folder from
Finder into Terminal, and press Enter. Then run:

```sh
npm ci --ignore-scripts
```

Expected: dependencies installed, no AI login or payment prompt. Do not run
commands with `sudo` to work around an error; ask your assistant to inspect it.

## 3. Install the AI client

For Codex, follow the [official installation guide](https://learn.chatgpt.com/docs/cli).
The official npm distribution can be installed with:

```sh
npm install -g @openai/codex
codex --version
```

This installs the client; it does not buy API credits. For Gemini, Claude, Grok
or OpenCode, use the corresponding section in [PROVIDERS.md](PROVIDERS.md) instead.
Each user must complete their own official login. Never download another user's
`auth.json`, `.env` or private installation link from an issue or chat.

## 4. Answer the setup questions

```sh
npm run setup -- --en
```

For the first Codex setup, press Enter for the default AI and model. Choose your
source and target language codes from the displayed list; for example `eng` and
`ita`. Keep the local address and port for now. Keep the default subtitle source
unless you already have a configured Subtitle Sync manifest.

The source URL is the **complete manifest URL**, including any private source
configuration. Store it only locally. A fallback is optional. The default of
20 jobs/day is our safeguard, not a promise of 20 source downloads or unlimited
AI usage. Failed admitted jobs can consume this counter. It resets at midnight UTC.

Expected: “Saved”. A private `.env` file is created. Do not upload it to GitHub.
Rerunning setup asks before updating it and keeps an ignored backup.

## 5. Sign in and check the connection

```sh
npm run login
npm run doctor
```

Complete the official sign-in yourself. For Codex choose your ChatGPT account.
The addon keeps this login in its own `data/accounts` directory, separate from
other coding projects. No API key is needed for the Codex subscription profile.

Doctor should find the client and, for Codex, the dedicated ChatGPT login. “Local
server not running yet” is normal at this point. For other clients, doctor cannot
prove account access: the following probe supplies that check.

If you agree to use a small amount of your AI quota, run:

```sh
npm run probe -- --confirm
```

Expected: two translated invented lines, preserved cue count and an elapsed time.
Read the translation. If the model is unavailable, select a supported model
explicitly; the addon will not silently change it or switch to an API.

## 6. Start the addon and inspect your private link

```sh
npm start
```

Leave this Terminal window open. You should see a health address. Open
`http://127.0.0.1:7017/health` in the Mac browser: it should show `status: ok`.
That checks the web service, not the AI.

Open a second Terminal window, enter the same project folder and run:

```sh
npm run link
```

Open the private `/install` link it prints. Press **Open in Stremio**, or copy the
manifest link into Stremio's addon URL field. The addon name includes your target
language. This loopback link is only a local development check: on an iPhone/TV,
`127.0.0.1` refers to that device, not your Mac.

## 7. Make it reachable from your playback devices

Follow [HOSTING.md](HOSTING.md). It offers a temporary HTTPS test and a permanent
hostname. A permanent hostname requires a domain you control; registration may
cost money. No domain or paid hosting service is purchased by this project.

After setting `PUBLIC_BASE_URL`, stop the foreground server with Control-C and
start it again. Run `npm run link` again and install the new HTTPS manifest.
Do not install the loopback URL on your phone or TV.

## 8. Test Stremio end to end

Use the same Stremio account on your playback devices. Fully close/reopen the
client after installing the addon if it has not synchronized yet.

1. Choose a movie/episode and the release you intend to watch.
2. Open subtitles and find your target language (the player may translate its name).
3. Choose the **AI Subtitles** track. For a new translation, wait and reselect it
   if the player does not retry. Do not repeatedly switch releases while testing.
4. Verify lines at the beginning, middle and end. A subtitle matching another
   release will retain that release's timing; AI does not repair mismatched sync.
5. Replay the same release. A completed cached translation should avoid new AI work.
6. Test on each actual device, including the TV if you plan to use it there.

An existing target-language track may be returned without any AI request. To
measure a new translation, use an uncached episode and temporarily choose
`PREFER_EXISTING=false`; keep quota limits enabled.

## 9. Optional automatic startup

Once foreground operation works, stop it with Control-C and follow the macOS
service section in [HOSTING.md](HOSTING.md). Test after a real restart and login.
Keep your Mac connected to power. Turning off the screen is different from
sleeping the computer. Do not disable FileVault or password protection.

For errors use [TROUBLESHOOTING.md](TROUBLESHOOTING.md). Keep private links and
credentials out of support messages.
