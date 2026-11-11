# PatternLab — private interview preparation studio

A local-first personal learning workspace for algorithms and coding interviews. Learn 22 technique families, tackle 76 curated Python challenges, run tests, receive graduated hints, and use optional ChatGPT-plan-powered coaching. No database, API key, or dependency installation is necessary.

> **Scope:** This version is designed for **one person running it on their own computer**. It is not a hosted multi-user application. It is not affiliated with LeetCode or any employer.

## Quick start (after cloning from GitHub)

**Prerequisite:** [Node.js 20 or newer](https://nodejs.org/). Internet access is required to load the CodeMirror editor assets and the Pyodide Python runtime from public CDNs. Internet is also needed for AI, but the lesson and stored-progress interface can work after the page has loaded.

```bash
git clone https://github.com/lazeeez/p1.git
cd patternlab
npm start
```

In your browser, visit **http://127.0.0.1:4173**. The app runs only on your computer's loopback interface. Leave the terminal running while you study; press `Ctrl+C` to stop.

No `npm install`, `.env` file, OpenAI API key, Python installation, or paid hosting service is required.

If port 4173 is busy, set a different port before starting:

- macOS/Linux: `PORT=4174 npm start`
- Windows PowerShell: `$env:PORT=4174; npm start`

Use the address printed in the terminal. Avoid switching between `localhost` and `127.0.0.1`, since browser storage is separate for each origin.

## Connecting your existing ChatGPT Plus subscription

1. Launch PatternLab locally and open **Settings** (gear icon).
2. Click **Continue with ChatGPT**.
3. A ChatGPT authorization page opens in your browser. Sign in and authorize the requested permissions, including **ChatGPT plan usage**.
4. After returning to PatternLab, open **Settings** to see your connected account and choose an available model. Enable **Use ChatGPT for coaching**.
5. Open any challenge and ask the interview coach for a conceptual explanation, a hint, complexity guidance, or an interpretation of a failing test.

This uses OpenAI's **official Sign in with ChatGPT flow for locally hosted open-source apps** and the public Responses API with `store:false` and `stream:true`. No ChatGPT authentication token is taken from the Codex CLI or placed into web-page JavaScript. The app **never silently switches to the separately billed standard OpenAI API**. Access is limited to eligible accounts, participating models, and your ChatGPT plan allowance. Limits, service eligibility, and API behavior can change. ChatGPT is optional; the built-in coaching fallback works without it.

References: [official open-source sign-in guide](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

### How coaching behaves

- **No spoilers by default:** starts with a small clue rather than handing over a complete implementation.
- **Ask for understanding:** *Explain the pattern* produces a mental model, illustrative example, and loop invariant.
- **Ask for debugging:** *Debug my code* includes your current Python draft and any available failing test results.
- **Ask for complexity:** helps you derive time and space costs instead of memorizing an answer.
- **Graceful fallback:** if sign-in, network access, or plan limits prevent an AI response, the built-in mentor responds, and the Python runner keeps working.

## What is included

| Capability | Implementation |
|---|---|
| Guided learning | 22 patterns with mental models, invariants, pitfalls, and short checks |
| Curated practice | 76 challenges, search/filter, difficulty progression, Python starters |
| Hints | Three unlockable stages per challenge, independent of AI |
| Python runner | Pyodide in a dedicated Web Worker, isolated from the UI thread |
| Code feedback | Example runs, full local test cases, pass/fail output, edge-case details |
| Retention | Saved drafts, notes, progress, reviews, simple spaced-repetition scheduling |
| Interview simulation | 45-minute mock timer, guiding interviewer, complexity and edge prompts |
| Backups | Export/Import progress as a JSON file |
| ChatGPT coaching | Optional, locally authenticated, no separate API key required |

The built-in test bank is **not equivalent to LeetCode's complete hidden test suite**, so passing every local case is evidence of correctness, not a mathematical proof. The curriculum is curated, not an exhaustive collection of every interview question ever asked. This is a study tool, not an assessment platform.

## Local privacy & security

- Node listens **only** on `127.0.0.1`. Do not put the server behind a public reverse proxy, run it with a tunnel, or expose it via router port forwarding.
- Protected ChatGPT credentials and the stable host ID are stored under **`~/.patternlab/`**, outside the Git repository; credential files use owner-only permissions where supported. **Never commit or share that directory.**
- The server serves only the six approved frontend assets; it never serves `server.js`, `auth.js`, credentials, or project metadata.
- CSRF protections require requests from the same browser origin; localhost host-header validation, request-size caps, and request throttling are in place.
- Candidate Python runs in a browser Worker with a ten-second watchdog. This makes an infinite loop recoverable, **not** a hardened security sandbox for running code supplied by untrusted strangers.
- Learning progress is stored in your **browser's localStorage** (not in your Git repository); clear browser data to erase it. Backup through **Settings → Export JSON** to transfer it between computers.
- ChatGPT sends the exercise, your recent chat messages, your editor draft, and relevant test results to OpenAI **only when you enable ChatGPT coaching and request a response**. No site analytics, tracking account, or cloud database is configured.
- On Windows, standard local-user OS access controls apply; owner-only POSIX file permission semantics differ.

## Code organization

```text
patternlab/
├── index.html         # Website entry point
├── styles.css         # Responsive product UI
├── app.js             # Views, editor integration, progress, coaching
├── catalog.js         # Lessons, problems, hints and test fixtures
├── runner.worker.js   # Python/WebAssembly runner and judge
├── server.js          # Local-only HTTP server and AI proxy
├── auth.js            # Official local ChatGPT OAuth client
├── tests/             # Native Node.js regression tests
├── .github/workflows/ # GitHub Actions test workflow
└── package.json       # npm start / npm test / npm run check
```

## Verification and maintenance

```bash
npm run check
npm test
```

The test suite covers content invariants, static-file allowlisting, host/origin CSRF defenses, request validation, offline API behavior, OAuth state / signed identity validation, authorization with a mock identity provider, token renewal, model discovery, and SSE completion. Python judging was additionally exercised with correct sample solutions for arrays, hash maps, linked lists, trees, and graphs. User-facing UI smoke tests covered navigation, notes, draft preservation, guidance, and Settings.

**Testing limitation:** A real end-to-end sign-in to *your* ChatGPT account has not been performed because it requires you to authorize your own account in a browser. The main browser runner/CodeMirror/Pyodide CDN loading should also be smoke-tested on your local machine. No automated test suite can prove that an app has zero bugs.

If you hit a problem: first try **Settings → Restart Python runtime**, check that your browser can access the external CDNs, and inspect the terminal for a local server error. For AI issues, open **Settings → Refresh models** or disconnect/reconnect your ChatGPT account.

## Upload to GitHub

Create a new **private, empty** repository named `patternlab` in GitHub (don't generate an extra README), then in the project folder run:

```bash
git init
git add .
git commit -m "Initial PatternLab personal release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/patternlab.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username. GitHub may prompt you to authenticate. After pushing, each update is `git add . && git commit -m "Improvement" && git push`. To use it on another laptop, clone the private repo, run `npm start`, and sign in to ChatGPT again; the browser progress requires an exported/imported JSON backup.

## License and deployment

The project is prepared as a **private personal-use repository** without a public open-source license. The official local open-source sign-in flow is documented for qualifying locally running/open-source apps; if you publish it publicly, choose a license and review applicable requirements. Do not deploy this backend unmodified to the public Internet. GitHub Pages will not run `server.js` or provide the same secure ChatGPT connection.
