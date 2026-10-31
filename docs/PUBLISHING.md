# Publish this repository on GitHub

Only the clean project directory belongs in the repository. Do not push the
parent migration workspace or an existing private runtime.

## Before the first push

```sh
npm ci --ignore-scripts
npm test
npm run smoke
npm run check:release
```

Review `git status` and the staged diff. The repository must contain no `.env`,
`data`, `runtime`, account sessions, private URLs, keys, real subtitles or logs.
The local check is a guardrail, not proof that arbitrary new files contain no secrets.
Enable GitHub secret scanning/push protection where available.

Create an **empty repository** in your GitHub account, for example
`stremio-ai-subtitles`. Choose public only when you intend to publish it. Do not
have GitHub generate a second README/license. Copy its exact remote URL.

If this directory has no Git history yet:

```sh
git init -b main
git add .
git diff --cached --stat
git commit -m "Prepare self-hosted Stremio AI subtitles addon"
```

The broad add is safe only after the clean-directory audit above; never run it
from the migration's parent folder. If an initial commit is already present,
skip those four commands. Set the remote using the URL copied from GitHub:

```sh
git remote add origin YOUR_COPIED_GITHUB_REMOTE_URL
git push -u origin main
```

Replace the placeholder with the real remote; do not paste access tokens into
URLs. Authenticate through GitHub's official tooling when asked. No secret or
AI account is required in GitHub Actions: CI uses mocks and synthetic dialogue.

Check the first Actions run before tagging a release. This repository contains
a CI definition, not evidence that GitHub has already run it. Publish as a preview
while new provider/OS combinations remain unverified. Keep VALIDATION.md honest.

## Release checklist

- [ ] Offline tests and synthetic Stremio smoke pass.
- [ ] Exact CLI versions and live provider results are documented where tested.
- [ ] macOS fresh install/login/startup verified by a real installer.
- [ ] Actual intended Stremio clients tested; no blanket TV/iOS guarantee.
- [ ] Runtime/cache/account files excluded from Git and release archive.
- [ ] License/third-party notices retained; official clients not bundled.
- [ ] README states experimental providers and unqualified platforms clearly.
- [ ] GitHub CI passes after push; secrets are not configured for tests.

For a source archive after committing:

```sh
git archive --format=zip --prefix=stremio-ai-subtitles/ --output=../stremio-ai-subtitles-source.zip HEAD
```

Keep private local settings and backups outside the archive. Never create a
release ZIP by indiscriminately compressing a configured working directory.
