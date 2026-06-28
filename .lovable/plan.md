
# Plan: Chicken Road game + Plinko multi-ball fix + Mines instant New Game

## 1. New Game: Chicken Road

A Crossy-Road / "Chicken" style cashout game inspired by the casino.guru reference, but with our own unique casino styling (gold accents, dark theme, glow effects, animated chicken sprite, lane-by-lane reveal with risk per step).

### Gameplay
- Player places a bet and selects a Difficulty: Easy / Medium / Hard / Daredevil.
  - Difficulty controls per-lane survival probability and the multiplier curve.
  - Easy: low risk, slow-growing multiplier (max ~5x).
  - Medium: balanced (max ~15x).
  - Hard: higher risk (max ~40x).
  - Daredevil: very high risk, fastest growth (max ~100x).
- A road of ~20 lanes is shown. Each tap on "Step" moves the chicken forward by one lane.
  - If the lane is "safe" → multiplier increases, payout preview updates.
  - If the lane is "hit by car" → loss animation, bet lost, game over.
- "Cash Out" button anytime to collect `bet × currentMultiplier`.
- Auto-cashout option (optional): set a target multiplier; auto-collect when reached.

### Probability & admin controls (uses the same system as other games)
- Uses `getEffectiveWinProbability('chicken_road', userId, betAmount, balance, maxPayout)` so it respects:
  1. User-specific forced wins/losses
  2. Max profit limit
  3. Auto-loss on bet increase
  4. User-specific win rate
  5. Roaming probability
  6. Game-specific / global win probability
- Per-lane survival probability is derived from the effective win probability and difficulty so the player's cumulative survival to the "target lane" matches the target win rate.
- Admin panel: add "Chicken Road" to per-game win rate sliders + multiplier configuration (max multiplier per difficulty).

### Visual / audio
- Dark asphalt road with animated lane dividers, neon gold curb, cars sliding across in losing lanes.
- Chicken sprite hops forward with bounce animation; tire-screech + cluck sound on loss, coin sound on safe step, jackpot sound on cashout.
- Confetti on win, shake on loss (same helpers used by other games).

### Persistence
- Uses `useGameSession('chicken_road')` so the run survives refresh and respects the 24h timer, same as other games.
- Recent bets logged into the existing `recent_bets` table for both player and admin views.

## 2. Plinko: rapid-fire ball drops with full animation

Problem: clicking "Drop Ball" quickly cancels/overlaps the previous animation.

Fix:
- Replace the single-ball state with a `balls[]` array. Each entry has its own id, position, velocity, target bucket, and animation frame.
- The physics loop iterates every active ball each frame; balls are removed when they land.
- The "Drop Ball" button is never disabled by an in-flight ball — every click pushes a new ball into the array, deducts the bet immediately, and schedules its own payout when it lands.
- A small "balls in air" counter is shown for clarity.
- Each ball still uses the win-probability biasing logic so admin win rates remain enforced per ball.

## 3. Mines: instant New Game

Problem: after a round ends, the user has to click "New Game" twice / it doesn't reset cleanly.

Fix:
- When the round finalizes (bomb hit or auto-cashout), keep the result visible but immediately:
  - Reset `grid`, `revealedCount`, `currentMultiplier`, `clickOrder`, `gameOver`, and clear the active session.
- The "New Game" button calls a single `startNewGame()` that:
  - Validates bet vs balance.
  - Deducts bet, generates fresh grid using the priority probability system, saves session, sets state to playing — all in one click, no intermediate "ready" state.
- Disable the button only while the async start is in-flight to prevent double-deduction (same pattern Mines already uses for first start).

## Technical details

### Files to add
- `src/components/games/ChickenRoadGame.tsx` — main game component.
- `src/components/games/chicken/ChickenSprite.tsx` — animated chicken.
- `src/components/games/chicken/RoadLane.tsx` — lane + car animation.
- Asset: generated `src/assets/chicken-road-bg.jpg` (dark neon road).

### Files to edit
- `src/lib/gameUtils.ts` — add `CHICKEN_ROAD_CONFIG` with difficulty → multiplier curves + per-lane survival math helper.
- `src/pages/GamePlayPage.tsx` — register `chicken_road` route + config.
- `src/pages/GamesPage.tsx` — add Chicken Road card.
- `src/pages/AdminPage.tsx` — add Chicken Road row to per-game win-rate sliders.
- `src/components/games/PlinkoGame.tsx` — refactor single-ball state into a `balls[]` array, update physics loop, remove button disable, immediate bet deduction per click.
- `src/components/games/MinesGame.tsx` — make `New Game` directly call `startNewGame()`; collapse end-of-round + start-new into one action.

### Database (Lovable Cloud)
- Insert default `game_settings` row: `win_probability_chicken_road = 0.4`.
- No new tables needed — reuses `active_game_sessions`, `recent_bets`, `user_win_rates`, `user_betting_controls`.

### Sound
- Reuse `useSoundEffects` hook with new cues: `step`, `crash`, `cashout` (mapped to existing sound files where possible).

### Verification
- Playwright drive: place bet → step a few lanes → cash out (chicken_road).
- Plinko: click drop ball 6 times in 1 second, confirm 6 balls visible mid-flight and all animate to buckets.
- Mines: finish a round, click New Game once, confirm new grid appears with bet deducted exactly once.
