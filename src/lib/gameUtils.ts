import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';

// Check for forced outcomes and profit limits
export const getUserBettingControl = async (userId: string): Promise<{
  forcedWin: boolean | null;
  maxProfitLimit: number | null;
  shouldDecrementWins: boolean;
  shouldDecrementLosses: boolean;
}> => {
  const { data } = await supabase
    .from('user_betting_controls')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return { forcedWin: null, maxProfitLimit: null, shouldDecrementWins: false, shouldDecrementLosses: false };
  }

  // Check for forced outcomes
  if (data.forced_wins_remaining > 0) {
    return { 
      forcedWin: true, 
      maxProfitLimit: data.max_profit_limit, 
      shouldDecrementWins: true,
      shouldDecrementLosses: false
    };
  }
  
  if (data.forced_losses_remaining > 0) {
    return { 
      forcedWin: false, 
      maxProfitLimit: data.max_profit_limit,
      shouldDecrementWins: false,
      shouldDecrementLosses: true
    };
  }

  return { 
    forcedWin: null, 
    maxProfitLimit: data.max_profit_limit,
    shouldDecrementWins: false,
    shouldDecrementLosses: false
  };
};

// Decrement forced outcomes after a bet
export const decrementForcedOutcome = async (userId: string, isWin: boolean) => {
  const { data } = await supabase
    .from('user_betting_controls')
    .select('forced_wins_remaining, forced_losses_remaining')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return;

  if (isWin && data.forced_wins_remaining > 0) {
    await supabase
      .from('user_betting_controls')
      .update({ 
        forced_wins_remaining: data.forced_wins_remaining - 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
  } else if (!isWin && data.forced_losses_remaining > 0) {
    await supabase
      .from('user_betting_controls')
      .update({ 
        forced_losses_remaining: data.forced_losses_remaining - 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
  }
};

// Check if user would exceed max profit limit
export const checkMaxProfitLimit = async (userId: string, potentialPayout: number, currentBalance: number): Promise<boolean> => {
  // First get the user's initial balance from profiles created_at
  const { data: profileData } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();
  
  // Default initial balance is 10 (set in handle_new_user trigger)
  const initialBalance = 10;
  
  const { data } = await supabase
    .from('user_betting_controls')
    .select('max_profit_limit')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data?.max_profit_limit) return false; // No limit set

  const currentProfit = currentBalance - initialBalance;
  const potentialProfit = currentProfit + potentialPayout;

  return potentialProfit > data.max_profit_limit;
};

// Check user-specific win rate for a specific game
export const checkUserSpecificWinRate = async (userId: string, game: string): Promise<number | null> => {
  const { data } = await supabase
    .from('user_win_rates')
    .select('win_probability')
    .eq('user_id', userId)
    .eq('game', game)
    .maybeSingle();
  
  return data?.win_probability ?? null;
};

// Fetch win probability from database for a specific game and user
export const getWinProbability = async (game?: string, userId?: string): Promise<number> => {
  // First check for user-specific rate
  if (userId && game) {
    const { data: userRate } = await supabase
      .from('user_win_rates')
      .select('win_probability')
      .eq('user_id', userId)
      .eq('game', game)
      .single();
    
    if (userRate?.win_probability !== undefined) {
      return userRate.win_probability;
    }
  }
  
  // Then check for game-specific rate
  if (game) {
    const { data: gameRate } = await supabase
      .from('game_settings')
      .select('setting_value')
      .eq('setting_key', `win_probability_${game}`)
      .single();
    
    if (gameRate?.setting_value !== undefined) {
      return gameRate.setting_value;
    }
  }
  
  // Fall back to global rate
  const { data } = await supabase
    .from('game_settings')
    .select('setting_value')
    .eq('setting_key', 'win_probability')
    .single();
  
  return data?.setting_value ?? 0.15;
};

// Check if roaming probability is enabled
export const isRoamingProbabilityEnabled = async (): Promise<boolean> => {
  const { data } = await supabase
    .from('game_settings')
    .select('setting_value')
    .eq('setting_key', 'roaming_probability_enabled')
    .single();
  
  return data?.setting_value === 1;
};

// Check if auto-loss on bet increase is enabled
export const isAutoLossOnIncreaseEnabled = async (): Promise<boolean> => {
  const { data } = await supabase
    .from('game_settings')
    .select('setting_value')
    .eq('setting_key', 'auto_loss_on_increase_enabled')
    .single();
  
  return data?.setting_value === 1;
};

// Get roaming probability (0-65% range, weighted for 4-5 wins per 10 bets)
// Target: 4-5 wins out of 10 bets (40-50% effective win rate)
export const getRoamingProbability = (): number => {
  // Use weighted random to achieve roughly 40-50% win rate on average
  const random = Math.random();
  
  // Weighted distribution for 4-5 wins per 10:
  // 25% chance: 0-25% win rate (occasional bad streak)
  // 45% chance: 35-50% win rate (normal play)
  // 30% chance: 50-65% win rate (good streak)
  if (random < 0.25) {
    // 25% of the time: 0-25% win rate (occasional bad streak)
    return Math.random() * 0.25;
  } else if (random < 0.70) {
    // 45% of the time: 35-50% win rate (normal play)
    return 0.35 + Math.random() * 0.15;
  } else {
    // 30% of the time: 50-65% win rate (good streak)
    return 0.50 + Math.random() * 0.15;
  }
};

// Store last bet amounts per user (in-memory for current session)
const lastBetAmounts: Map<string, number> = new Map();

// Check if user increased their bet and should auto-lose
export const checkAutoLossOnIncrease = async (userId: string, currentBet: number): Promise<boolean> => {
  const autoLossEnabled = await isAutoLossOnIncreaseEnabled();
  
  if (!autoLossEnabled) {
    // Still track the bet for future reference
    lastBetAmounts.set(userId, currentBet);
    return false;
  }
  
  const lastBet = lastBetAmounts.get(userId);
  lastBetAmounts.set(userId, currentBet);
  
  // If this is the first bet or bet is same/lower, no auto-loss
  if (lastBet === undefined || currentBet <= lastBet) {
    return false;
  }
  
  // User increased their bet - trigger auto-loss
  return true;
};

// Reset last bet for a user (call when they leave or on new session)
export const resetLastBet = (userId: string) => {
  lastBetAmounts.delete(userId);
};

// Get effective win probability considering all factors
// PRIORITY ORDER (Highest to Lowest):
// 1. User-Specific Betting Controls (forced wins/losses)
// 2. Max Profit Limit (if would exceed, force loss)
// 3. Auto-Loss on Bet Increase
// 4. User-Specific Win Rates (per user, per game)
// 5. Roaming Probability (if enabled)
// 6. Game-Specific Win Probability
// 7. Global Win Probability (fallback)
export const getEffectiveWinProbability = async (
  game: string, 
  userId: string,
  betAmount: number,
  currentBalance?: number,
  potentialMaxPayout?: number
): Promise<{ probability: number; forceLoss: boolean; forceWin: boolean }> => {
  // PRIORITY 1: Check forced wins/losses from betting controls
  const bettingControl = await getUserBettingControl(userId);
  
  if (bettingControl.forcedWin === true) {
    return { probability: 1, forceLoss: false, forceWin: true };
  }
  
  if (bettingControl.forcedWin === false) {
    return { probability: 0, forceLoss: true, forceWin: false };
  }
  
  // PRIORITY 2: Check max profit limit - if would exceed, force loss
  if (currentBalance !== undefined && potentialMaxPayout !== undefined && bettingControl.maxProfitLimit !== null) {
    const initialBalance = 10; // Default initial balance from handle_new_user trigger
    const currentProfit = currentBalance - initialBalance;
    const potentialProfit = currentProfit + potentialMaxPayout;
    
    if (potentialProfit > bettingControl.maxProfitLimit) {
      return { probability: 0, forceLoss: true, forceWin: false };
    }
  }
  
  // PRIORITY 3: Check auto-loss on bet increase
  const shouldAutoLose = await checkAutoLossOnIncrease(userId, betAmount);
  if (shouldAutoLose) {
    return { probability: 0, forceLoss: true, forceWin: false };
  }
  
  // PRIORITY 4: Check user-specific win rate for this game
  const userSpecificRate = await checkUserSpecificWinRate(userId, game);
  if (userSpecificRate !== null) {
    // User has a specific rate set - use it and SKIP roaming probability
    return { probability: userSpecificRate, forceLoss: false, forceWin: false };
  }
  
  // PRIORITY 5: Check if roaming probability is enabled
  const roamingEnabled = await isRoamingProbabilityEnabled();
  if (roamingEnabled) {
    const roamingProb = getRoamingProbability();
    return { probability: roamingProb, forceLoss: false, forceWin: false };
  }
  
  // PRIORITY 6 & 7: Use standard probability hierarchy (game-specific → global)
  const standardProb = await getWinProbability(game, userId);
  return { probability: standardProb, forceLoss: false, forceWin: false };
};

// Seeded random with configurable win probability
export const checkWin = (winProbability: number = 0.15): boolean => {
  return Math.random() < winProbability;
};

export const calculatePayout = (bet: number, won: boolean, multiplier: number = 2.5): number => {
  return won ? Math.floor(bet * multiplier) : 0;
};

export const triggerWinConfetti = () => {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#D4AF37', '#FFD700', '#FFA500', '#00CED1', '#FF69B4'],
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#D4AF37', '#FFD700', '#FFA500', '#00CED1', '#FF69B4'],
    });
  }, 250);
};

export const formatCredits = (amount: number): string => {
  return new Intl.NumberFormat('en-NP').format(amount);
};

// Slot machine symbols
export const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣', '🎰'];

export const getRandomSlotSymbol = (): string => {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
};

// Roulette numbers and colors
export const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, i) => i);
export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export const getRouletteColor = (num: number): 'red' | 'black' | 'green' => {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
};

// Card game utilities
export const CARD_SUITS = ['♠', '♥', '♦', '♣'] as const;
export const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export interface Card {
  suit: typeof CARD_SUITS[number];
  value: typeof CARD_VALUES[number];
}

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of CARD_SUITS) {
    for (const value of CARD_VALUES) {
      deck.push({ suit, value });
    }
  }
  return shuffleDeck(deck);
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const getCardValue = (card: Card): number => {
  if (card.value === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.value)) return 10;
  return parseInt(card.value);
};

export const calculateHandValue = (hand: Card[]): number => {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.value === 'A') {
      aces++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
};

export const isCardRed = (card: Card): boolean => {
  return card.suit === '♥' || card.suit === '♦';
};