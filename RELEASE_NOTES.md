# PatternLab 2.1 — Deep study and expanding practice

## Additions

- Full study guides for all 22 curated algorithm patterns. Every guide has learning objectives, intuition, a traced example, a reusable Python reference template, complexity reasoning, alternatives, common mistakes, and recall questions.
- A "Study notes" shortcut from the coding workspace and a study-first homepage action.
- Deterministic fresh test-case variants for 12 curated problem contracts. Remixes are saved separately and can be re-solved without seeing old code.
- Optional ChatGPT-powered generation of additional personal pattern guides and related exercises, with strict data-shape validation and a localhost-only backend.
- AI-created exercises marked as unverified drafts and excluded from verified mastery, as their generated test answers cannot be assumed correct.
- JSON backup/restore now includes saved personal patterns and exercises.
- Improved protection against crashes after clearing or importing personal content.

## Verification

- `npm run check` completed.
- `npm test` passed all 13 test groups locally. New tests validate all 22 guides, 12 remix generators over 180 seeds, personal content attachment, and API generation guards.
- Controlled-browser checks passed for study pages, editable practice, problem remixes, offline generation fallback, and responsive layouts at widths 375, 450, 768, 1024, and 1440px without page JavaScript errors or horizontal overflow.

## Known limits

- Live ChatGPT authorization and successful AI content generation could not be tested against your actual ChatGPT account. A real first-run check on your own machine is still needed.
- Local browser execution depends on a browser that can load Pyodide from its CDN; direct localhost navigation was blocked in the current test environment, so browser testing used a controlled equivalent.
- AI-created exercise fixtures are intentionally not counted as verified mastery; review them critically.
- New content and progress are saved only in your browser profile; use Settings → Export/Import JSON to move between devices.
- The archive is a source-code update for the application; it does not alter your GitHub repository by itself.
