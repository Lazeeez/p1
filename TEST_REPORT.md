# PatternLab source verification report

Run date: 2026-11-11

## Executed checks

- `npm run check` — passed, validating JavaScript syntax for all seven application modules.
- `npm test` — passed, 13/13 native Node tests; 0 failures, total runtime approximately 5.3 seconds.
- Test coverage includes authentication token validation, a **mocked** local OAuth lifecycle, curriculum integrity, the full set of 22 pre-practice guides, seeded deterministic case generators, content validation, the Python judging harness (including numeric int/float comparison), permitted static assets, localhost restrictions, unauthorized API safeguards, and generated-content input validation.

## What these checks do not verify

- A live sign-in with your ChatGPT Plus account, model allowance, or successful AI responses from OpenAI.
- Real Pyodide CDN loading in your browser or visual responsiveness on your device.
- Full security or correctness of every exercise against hidden LeetCode test cases.

## Run independently

```sh
npm run check
npm test
npm start
```

Visit `http://127.0.0.1:4173` and test one problem submission and one AI hint after signing in. Never commit `~/.patternlab/` (the locally stored login credentials).
