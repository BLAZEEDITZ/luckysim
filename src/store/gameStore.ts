import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  balance: number;
  isAdmin: boolean;
  createdAt: string;
}

export interface BetLog {
  id: string;
  odamBil: string;
  odamEmail: string;
  game: string;
  betAmount: number;
  won: boolean;
  payout: number;
  timestamp: string;
}

export interface GameConfig {
  id: string;
  name: string;
  enabled: boolean;
  minBet: number;
  maxBet: number;
  winProbability: number;
  payoutMultiplier: number;
}

interface GameState {
  // User state
  currentUser: User | null;
  users: User[];
  
  // Game state
  betLogs: BetLog[];
  soundEnabled: boolean;
  games: GameConfig[];
  
  // Actions
  login: (email: string, password: string) => { success: boolean; message: string };
  register: (email: string, password: string) => { success: boolean; message: string };
  logout: () => void;
  
  updateBalance: (amount: number) => void;
  placeBet: (game: string, betAmount: number, won: boolean, payout: number) => void;
  
  toggleSound: () => void;
  toggleGame: (gameId: string) => void;
  resetUserBalance: (userId: string) => void;
  
  getAllUsers: () => User[];
  getBetLogs: () => BetLog[];
  getStats: () => {
    totalUsers: number;
    totalBets: number;
    totalWagered: number;
    houseProfit: number;
    winRate: number;
  };
}

const INITIAL_BALANCE = 10000;

const DEFAULT_GAMES: GameConfig[] = [
  {
    id: 'slots',
    name: 'Lucky Spin Slots',
    enabled: true,
    minBet: 10,
    maxBet: 1000,
    winProbability: 0.33,
    payoutMultiplier: 2.5,
  },
  {
    id: 'roulette',
    name: 'Classic Roulette',
    enabled: true,
    minBet: 5,
    maxBet: 500,
    winProbability: 0.33,
    payoutMultiplier: 2.5,
  },
  {
    id: 'blackjack',
    name: '21 Blackjack',
    enabled: true,
    minBet: 20,
    maxBet: 2000,
    winProbability: 0.33,
    payoutMultiplier: 2.5,
  },
];

// Simple password storage (in production, use proper hashing)
const passwords: Record<string, string> = {};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],
      betLogs: [],
      soundEnabled: true,
      games: DEFAULT_GAMES,

      login: (email, password) => {
        const { users } = get();
        
        // Check admin
        if (email === 'admin@luckysim.com' && password === 'SecurePass123!') {
          const adminUser: User = {
            id: 'admin',
            email: 'admin@luckysim.com',
            balance: 999999,
            isAdmin: true,
            createdAt: new Date().toISOString(),
          };
          set({ currentUser: adminUser });
          return { success: true, message: 'Welcome, Admin!' };
        }
        
        const user = users.find(u => u.email === email);
        if (!user) {
          return { success: false, message: 'User not found. Please register.' };
        }
        
        if (passwords[email] !== password) {
          return { success: false, message: 'Incorrect password.' };
        }
        
        set({ currentUser: user });
        return { success: true, message: 'Welcome back!' };
      },

      register: (email, password) => {
        const { users } = get();
        
        if (users.find(u => u.email === email)) {
          return { success: false, message: 'Email already registered.' };
        }
        
        if (password.length < 6) {
          return { success: false, message: 'Password must be at least 6 characters.' };
        }
        
        const newUser: User = {
          id: crypto.randomUUID(),
          email,
          balance: INITIAL_BALANCE,
          isAdmin: false,
          createdAt: new Date().toISOString(),
        };
        
        passwords[email] = password;
        set({ users: [...users, newUser], currentUser: newUser });
        return { success: true, message: `Welcome! You've received ${INITIAL_BALANCE} credits!` };
      },

      logout: () => set({ currentUser: null }),

      updateBalance: (amount) => {
        const { currentUser, users } = get();
        if (!currentUser) return;
        
        const newBalance = Math.max(0, currentUser.balance + amount);
        const updatedUser = { ...currentUser, balance: newBalance };
        
        set({
          currentUser: updatedUser,
          users: users.map(u => u.id === currentUser.id ? updatedUser : u),
        });
      },

      placeBet: (game, betAmount, won, payout) => {
        const { currentUser, betLogs } = get();
        if (!currentUser) return;
        
        const log: BetLog = {
          id: crypto.randomUUID(),
          odamBil: currentUser.id,
          odamEmail: currentUser.email,
          game,
          betAmount,
          won,
          payout,
          timestamp: new Date().toISOString(),
        };
        
        set({ betLogs: [log, ...betLogs].slice(0, 1000) }); // Keep last 1000 logs
      },

      toggleSound: () => set(state => ({ soundEnabled: !state.soundEnabled })),

      toggleGame: (gameId) => {
        const { games } = get();
        set({
          games: games.map(g => g.id === gameId ? { ...g, enabled: !g.enabled } : g),
        });
      },

      resetUserBalance: (userId) => {
        const { users, currentUser } = get();
        set({
          users: users.map(u => u.id === userId ? { ...u, balance: INITIAL_BALANCE } : u),
          currentUser: currentUser?.id === userId ? { ...currentUser, balance: INITIAL_BALANCE } : currentUser,
        });
      },

      getAllUsers: () => get().users,
      getBetLogs: () => get().betLogs,
      
      getStats: () => {
        const { users, betLogs } = get();
        const totalBets = betLogs.length;
        const totalWagered = betLogs.reduce((acc, log) => acc + log.betAmount, 0);
        const totalPayouts = betLogs.reduce((acc, log) => acc + log.payout, 0);
        const wins = betLogs.filter(log => log.won).length;
        
        return {
          totalUsers: users.length,
          totalBets,
          totalWagered,
          houseProfit: totalWagered - totalPayouts,
          winRate: totalBets > 0 ? (wins / totalBets) * 100 : 0,
        };
      },
    }),
    {
      name: 'luckysim-storage',
    }
  )
);
