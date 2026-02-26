# golf-leaderboard
Display the leaderboard of the current week's PGA tournament in your terminal.

```
git clone https://github.com/maxthyen/golf-leaderboard.git
cd golf-leaderboard
npm install
npm start
```

## Interaction
- Type in the top filter box to narrow the player list.
- Move through players with arrow keys (or click).
- When a player is selected, a scorecard panel shows round-by-round hole scores.

This project was mostly an excuse to demonstrate the use of [table-scraper](https://github.com/maxthyen/table-scraper) 
and experiment with [blessed](https://github.com/chjj/blessed) and [blessed-contrb](https://github.com/yaronn/blessed-contrib).

![golf-leaderboard screenshot](https://i.imgur.com/vnkpNp0.png)
