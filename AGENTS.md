# Repository Guidelines

## Project Structure & Module Organization

`src/index.ts` implements the Node-hosted vision bridge, routes, tools, and adapter integration; `src/client/index.tsx` registers the browser UI. Host modules live under `src/`; React components, stores, localization, and CSS Modules live in `src/client/`. Tests are in `tests/*.test.mjs`, and images and diagrams in `assets/`. `lib/` is committed distribution output; do not edit it by hand. Bundle metadata and build configuration live in `cordis.patch.yml`, `tsconfig.json`, and `tsdown.config.ts`.

## Build, Test, and Development Commands

- `npm run bootstrap` links dependencies from a nearby `deepseek-harness` checkout. For another layout, set `HARNESS=/absolute/path/to/deepseek-harness`.
- `npm test` runs all tests through Node's built-in test runner.
- `npm run typecheck` checks strict TypeScript and emits declarations into `lib/types/`.
- `npm run build` creates the host ESM bundles and browser bundle in `lib/`.
- `npm pack --dry-run` verifies the files that will ship to npm.

Use Node 22, matching CI. For an end-to-end check, run `dsh plugin --profile web add link:/absolute/path/to/dsh-visual-plugin`, then restart `dsh web`.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, no semicolons, trailing commas in multiline constructs, and explicit types at public boundaries. Use `camelCase` for functions and variables, `PascalCase` for components and types, and matching `ComponentName.tsx` / `ComponentName.module.css` filenames. Include `.ts` or `.tsx` import extensions. Prefer Harness theme tokens in CSS and short JSDoc for exported APIs or integration seams.

## Testing Guidelines

Write focused `node:test` cases using `node:assert/strict`; name files `<feature>.test.mjs` and tests by observable behavior. Cover host logic, browser registration contracts, and UI source/CSS invariants as applicable. There is no coverage threshold, but behavior changes should include a relevant test. Before submitting, run tests, typecheck, and build, then commit regenerated `lib/` files.

## Commit & Pull Request Guidelines

History follows Conventional Commit-style subjects such as `feat:`, `fix:`, `fix(build):`, `docs:`, `assets:`, and `chore:`. Keep subjects imperative and narrowly scoped. Pull requests should explain the user-visible change, link relevant issues, list verification commands, and include screenshots for settings, panel, or activity-card changes. Confirm committed bundles and `npm pack --dry-run` contents remain current.

## Security & Configuration

Never commit vision API keys, credentials, or local endpoint details. Store them through the Vision Bridge settings UI, and keep machine-specific Harness paths in the `HARNESS` environment variable.
