import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';

// Fetch win probability from database (default 15%)
export const getWinProbability = async (): Promise<number> => {
  const { data } = await supabase
    .from('game_settings')
    .select('setting_value')
    .eq('setting_key', 'win_probability')
    .single();
  
  return data?.setting_value ?? 0.15;
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