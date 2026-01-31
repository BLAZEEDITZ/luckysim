
# Plan: Fix Win Probability Priority System and Roaming Probability

## Issues Identified

After analyzing the codebase, I found these problems:

1. **Priority Order is Wrong**: Currently, when "Roaming Probability" is enabled, it completely ignores user-specific win rates. The user-specific settings should always take the highest priority.

2. **Roaming Probability Targets 3-4 Wins**: You want 4-5 wins per 10 bets instead.

3. **Max Profit Limit Not Enforced Properly**: The max profit check exists but doesn't properly force a loss when the limit would be exceeded.

4. **User-Specific Win Rate Not Working**: Because roaming probability takes priority over user-specific rates in the current logic.

## Correct Priority Order (Highest to Lowest)

```text
1. User-Specific Betting Controls (forced wins/losses)
2. Max Profit Limit (if would exceed, force loss)
3. User-Specific Win Rates (per user, per game)
4. Roaming Probability (if enabled)
5. Game-Specific Win Probability
6. Global Win Probability (fallback)
```

---

## Technical Changes

### 1. Update `src/lib/gameUtils.ts` - Fix Priority and Roaming Probability

**Changes to `getRoamingProbability` function:**
- Adjust weighted distribution to achieve 4-5 wins per 10 bets (40-50% effective win rate)
- Change from current 30-40% to 40-50% average

**Changes to `getEffectiveWinProbability` function:**
- Restructure priority order to check user-specific win rates BEFORE roaming probability
- Properly enforce max profit limit by returning forced loss when exceeded
- Ensure betting controls (forced wins/losses) always have highest priority

**New function `checkUserSpecificWinRate`:**
- Query user_win_rates table for user+game combination
- Return specific rate if found, null otherwise

### 2. Update Game Components

Each game component currently handles max profit limit check separately. Update all games to use the centralized logic:
- `SlotMachine.tsx`
- `MinesGame.tsx`
- `RouletteGame.tsx`
- `BlackjackGame.tsx`
- `PlinkoGame.tsx`

---

## Detailed Code Changes

### File: `src/lib/gameUtils.ts`

**A. Update `getRoamingProbability` function (line ~156-172):**

Current weighted distribution:
- 60% chance: 0-20% win rate
- 30% chance: 20-35% win rate
- 10% chance: 35-50% win rate

New weighted distribution for 4-5 wins per 10:
- 30% chance: 0-25% win rate (occasional bad streak)
- 40% chance: 35-50% win rate (normal play)
- 30% chance: 50-65% win rate (good streak)

**B. Complete rewrite of `getEffectiveWinProbability` function (line ~204-238):**

New priority logic:
```
1. Check forced wins/losses from betting controls - HIGHEST PRIORITY
2. Check max profit limit - if exceeded, force loss
3. Check auto-loss on bet increase
4. Check user-specific win rate for this game
5. If user-specific rate exists, use it (skip roaming)
6. If roaming enabled, use roaming probability
7. Use standard game/global probability - LOWEST PRIORITY
```

**C. Update `checkMaxProfitLimit` function (line ~77-91):**

Add parameter to get user's initial balance from profiles table for accurate profit calculation.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/gameUtils.ts` | Fix priority order in `getEffectiveWinProbability`, update `getRoamingProbability` for 4-5 wins |
| `src/components/games/SlotMachine.tsx` | Remove redundant max profit check, rely on centralized logic |
| `src/components/games/MinesGame.tsx` | Remove redundant max profit check, rely on centralized logic |
| `src/components/games/RouletteGame.tsx` | Remove redundant max profit check, rely on centralized logic |
| `src/components/games/BlackjackGame.tsx` | Remove redundant max profit check, rely on centralized logic |
| `src/components/games/PlinkoGame.tsx` | Remove redundant max profit check, rely on centralized logic |

---

## Expected Behavior After Fix

1. **User-Specific Settings Always Work**: If you set a user's mines win rate to 100%, they will always win at mines regardless of roaming or global settings

2. **Forced Wins/Losses Have Highest Priority**: If you set 5 forced wins for a user, their next 5 bets will be wins

3. **Max Profit Limit Works**: If a user is set to max 1000 profit and they've already profited 900, any bet that could push them over 1000 will be a loss

4. **Roaming Probability Gives 4-5 Wins per 10**: Average win rate will be approximately 40-50%

5. **Auto-Loss on Increase Still Works**: Users who increase their bet will still lose that round (if enabled)
