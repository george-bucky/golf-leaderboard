# Fore! Golf Scores

Follow live golf events in your terminal with Fore Golf Scores.

This app pulls current leaderboard data from ESPN and gives you a fast keyboard-friendly way to switch events, follow players, open scorecards, and check round details without leaving the terminal.

## Features

- Browse current PGA, LPGA, DP World Tour, and LIV events from the built-in event selector.
- Open a live or completed leaderboard with round-by-round scoring columns.
- Preview the selected player's scorecard in a side panel on wider terminals.
- Open a full-screen player detail view with every round and event stats.
- Mark favorite players for the current event and switch between all, active, and favorites-only views.
- Jump straight to a player by typing the start of their name.
- Auto-refresh more often when an event is live and less often when it is not.
- No API key or login required.

## Requirements

- Node 20 is the easiest option for this project. The repo includes a `.nvmrc` file for that version.
- An internet connection is required because leaderboard data comes from ESPN.
- A wider terminal gives the best experience. The side scorecard panel shows when the terminal is wide enough.

## Launch

Clone the repo, then run:

```sh
git clone https://github.com/george-bucky/golf-leaderboard.git
cd golf-leaderboard
nvm use
npm install
npm start
```

If you already use Node 20, you can skip `nvm use`.

## Homebrew

You can install it with Homebrew as `fore`.

The smoothest path is:

```sh
brew tap george-bucky/fore
brew install fore
fore
```

There is also a one-line install:

```sh
brew install george-bucky/fore/fore
```

The tap repo is:

- `https://github.com/george-bucky/homebrew-fore`

This repo also includes the local source files behind that setup:

- the app exposes a real `fore` command
- there is a Homebrew formula template at `packaging/homebrew/fore.rb`
- there are setup notes at `docs/homebrew.md`

## Controls

### Event Selector

- `Arrow keys` or `h j k l`: move between events
- `Enter`: open the selected event
- `` ` ``: refresh the event list
- `1`: reopen the event selector
- `Ctrl+C`: quit

### Leaderboard

- `Arrow keys` or mouse: move through players
- `Enter`: open the full player detail screen
- `/`: switch between all players, active players, and favorites
- `;`: add or remove the selected player as a favorite
- `A-Z`: jump to players by typing the start of a name
- `Esc`: jump back to the top of the leaderboard
- `` ` ``: refresh the current leaderboard
- `1`: go back to event selection

### Player Detail

- `L`: return to the leaderboard
- `Esc`: close detail and jump back to the top
- `1`: go back to event selection

## Screenshots

### Event Selector

<img width="1199" height="546" alt="image" src="https://github.com/user-attachments/assets/5b2c4a71-131c-43fe-bf24-b5ef6afad1cb" />


### Leaderboard With Scorecard

<img width="1198" height="540" alt="image" src="https://github.com/user-attachments/assets/e70ac8a8-e8b0-44f3-bddc-a7c12dc6c9d0" />


### Full Player Detail

<img width="1019" height="1179" alt="image" src="https://github.com/user-attachments/assets/4f2825a0-fb4c-43af-9e12-92d80f472378" />


## Notes

- Data is pulled from ESPN's public golf endpoints.
- Favorites are kept in memory for the current app session.
- `npm test` runs a few small regression checks, but the main way to check UI changes is still by running the app.
