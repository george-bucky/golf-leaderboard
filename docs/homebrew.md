# Homebrew Setup

People can now install this app with:

```sh
brew tap george-bucky/fore
brew install fore
```

The tap repo is:

- `https://github.com/george-bucky/homebrew-fore`

## Current setup

1. The tap repo exists and includes `Formula/fore.rb`.
2. The current formula points at the public `master` snapshot of `george-bucky/golf-leaderboard`.
3. The formula creates the `fore` command during install.

Once tapped, people can run:

```sh
fore
```

If you want a one-line install without asking people to tap first, they can use:

```sh
brew install george-bucky/fore/fore
```

## Why this is set up this way

Homebrew recommends direct install with the full tap path for third-party formulas, and once a tap is added, users can install by the short formula name. Plain `brew install fore` from a fresh machine only works after the tap has already been added, unless the formula is accepted into Homebrew core.

## Next cleanup step

Right now the tap installs from the current public snapshot so the command works immediately. The better long-term version is to switch the formula to a tagged release after the latest app changes are pushed.

## Release checklist

1. Bump the version in `package.json`.
2. Commit and tag the release, for example `v0.1.0`.
3. Create the GitHub release.
4. Download the release tarball and calculate its SHA256.
5. Update `Formula/fore.rb` in the tap repo with the new version, URL, and SHA.
6. Commit the formula update in the tap repo.
