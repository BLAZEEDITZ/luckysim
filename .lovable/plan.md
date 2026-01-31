
# Plan: Fix Win Probability Priority System and Roaming Probability

## ✅ COMPLETED

All changes have been implemented successfully.

## Changes Made

### 1. Updated `src/lib/gameUtils.ts`

**A. Updated `getRoamingProbability` function:**
- Changed from 30-40% average to 40-50% average (4-5 wins per 10 bets)
- New weighted distribution:
  - 25% chance: 0-25% win rate (occasional bad streak)
  - 45% chance: 35-50% win rate (normal play)
  - 30% chance: 50-65% win rate (good streak)

**B. Rewrote `getEffectiveWinProbability` function with correct priority:**
```
1. User-Specific Betting Controls (forced wins/losses) - HIGHEST PRIORITY
2. Max Profit Limit (if would exceed, force loss)
3. Auto-Loss on Bet Increase
4. User-Specific Win Rates (per user, per game) - SKIPS ROAMING IF SET
5. Roaming Probability (if enabled)
6. Game-Specific Win Probability
7. Global Win Probability (fallback) - LOWEST PRIORITY
```

**C. Added `checkUserSpecificWinRate` helper function:**
- Queries user_win_rates table for user+game combination
- Returns specific rate if found, null otherwise

**D. Updated `checkMaxProfitLimit` function:**
- Now properly integrated into getEffectiveWinProbability

### 2. Updated All Game Components

Removed redundant separate `checkMaxProfitLimit` calls from:
- `SlotMachine.tsx`
- `MinesGame.tsx`
- `RouletteGame.tsx`
- `BlackjackGame.tsx`
- `PlinkoGame.tsx`

All games now pass `currentBalance` and `potentialMaxPayout` to `getEffectiveWinProbability` for unified handling.

## Expected Behavior

1. **User-Specific Settings Always Work**: If you set a user's mines win rate to 100%, they will always win at mines regardless of roaming or global settings

2. **Forced Wins/Losses Have Highest Priority**: If you set 5 forced wins for a user, their next 5 bets will be wins

3. **Max Profit Limit Works**: If a user is set to max 1000 profit and they've already profited 900, any bet that could push them over 1000 will be a loss

4. **Roaming Probability Gives 4-5 Wins per 10**: Average win rate will be approximately 40-50%

5. **Auto-Loss on Increase Still Works**: Users who increase their bet will still lose that round (if enabled)
