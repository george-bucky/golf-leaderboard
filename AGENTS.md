# Repository Guidelines

## Project Structure & Module Organization
This repo is a small terminal app. `index.js` is the main entry point and holds the screen layout, keyboard controls, ESPN data fetching, and refresh logic. `package.json` defines scripts, dependencies, and the Node version requirement. `README.md` covers quick start. `leaderboard.log` is runtime output, not a source file. There is no `src/` or `test/` folder yet, so keep new helpers close to the code they support and split large changes into small named functions.

## Build, Test, and Development Commands
- `nvm use` selects the Node version from `.nvmrc`.
- `npm install` installs local dependencies.
- `npm start` runs the leaderboard in the terminal.
- `npm test` is still a placeholder and currently fails by design.

There is no build step. Most changes should be checked by running `npm start` and trying the main flows yourself.

## Coding Style & Naming Conventions
Match the existing style in `index.js`: 2-space indentation, single quotes, semicolons, and CommonJS `require(...)`. Prefer `const` unless a value needs to change. Use `camelCase` for variables and functions, and `UPPER_SNAKE_CASE` for shared constants such as `SCORE_STYLES`. Choose clear function names that describe the action, like `openEventSelector` or `requestLeaderboardUpdate`.

## Testing Guidelines
Automated tests are not set up yet, so manual checks matter. Before opening a PR, run `npm start` and verify event switching, player filtering, scorecard/detail views, and refresh behavior. If you add automated tests, place them in a new `test/` folder and use names like `leaderboard.test.js`.

## Commit & Pull Request Guidelines
Recent commits use short, direct subjects such as `fix multi round scoring` and `Polish leaderboard table view`. Follow that style: one clear change per commit, written as a brief action. Pull requests should explain what changed, why it changed, and how you checked it. Include a screenshot or terminal capture when the UI layout or interactions change.
