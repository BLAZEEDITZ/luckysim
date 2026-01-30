import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/layout/Header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCredits } from "@/lib/gameUtils";
import { toast } from "sonner";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { 
  useBetLogsSubscription, 
  useProfilesSubscription, 
  useTransactionsSubscription,
  useGameSettingsSubscription 
} from "@/hooks/useRealtimeSubscription";
import { 
  Users, 
  TrendingUp, 
  Coins, 
  BarChart3,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings,
  Save,
  Gamepad2,
  Calendar,
  Target,
  Ban,
  Zap,
  Shuffle,
  TrendingDown,
  Activity
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  user_email?: string;
}

interface Profile {
  id: string;
  email: string;
  balance: number;
  created_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface BetLog {
  id: string;
  user_id: string;
  game: string;
  bet_amount: number;
  won: boolean;
  payout: number;
  created_at: string;
  user_email?: string;
  isNew?: boolean;
}

interface GroupedBets {
  [key: string]: BetLog[];
}

interface GameWinRates {
  slots: number;
  roulette: number;
  blackjack: number;
  plinko: number;
  mines: number;
}

interface UserWinRate {
  user_id: string;
  game: string;
  win_probability: number;
}

interface UserBettingControl {
  id: string;
  user_id: string;
  max_profit_limit: number | null;
  forced_wins_remaining: number;
  forced_losses_remaining: number;
}

const GAME_NAMES: Record<string, string> = {
  slots: 'Lucky Slots',
  roulette: 'Roulette',
  blackjack: 'Blackjack',
  plinko: 'Plinko',
  mines: 'Mines'
};

const AdminPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [betLogs, setBetLogs] = useState<BetLog[]>([]);
  const [globalWinProbability, setGlobalWinProbability] = useState(15);
  const [gameWinRates, setGameWinRates] = useState<GameWinRates>({
    slots: 15, roulette: 15, blackjack: 15, plinko: 15, mines: 15
  });
  const [userWinRates, setUserWinRates] = useState<UserWinRate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<string>('slots');
  const [userSpecificRate, setUserSpecificRate] = useState<number>(15);
  const [userBettingControls, setUserBettingControls] = useState<UserBettingControl[]>([]);
  const [selectedControlUserId, setSelectedControlUserId] = useState<string>('');
  const [maxProfitLimit, setMaxProfitLimit] = useState<number | null>(null);
  const [forcedWins, setForcedWins] = useState<number>(0);
  const [forcedLosses, setForcedLosses] = useState<number>(0);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBets: 0,
    totalWagered: 0,
    winRate: 0
  });
  const [roamingEnabled, setRoamingEnabled] = useState(false);
  const [autoLossOnIncreaseEnabled, setAutoLossOnIncreaseEnabled] = useState(false);
  const betsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
      fetchGameSettings();
      fetchUserWinRates();
      fetchUserBettingControls();
    }
  }, [isAdmin]);

  // Real-time subscriptions
  const handleNewBet = useCallback((bet: Record<string, unknown>) => {
    const player = profiles.find(p => p.id === bet.user_id);
    const newBet: BetLog = {
      id: bet.id as string,
      user_id: bet.user_id as string,
      game: bet.game as string,
      bet_amount: bet.bet_amount as number,
      won: bet.won as boolean,
      payout: bet.payout as number,
      created_at: bet.created_at as string,
      user_email: player?.email || 'Unknown',
      isNew: true
    };
    
    setBetLogs(prev => [newBet, ...prev]);
    
    // Update stats
    setStats(prev => ({
      ...prev,
      totalBets: prev.totalBets + 1,
      totalWagered: prev.totalWagered + newBet.bet_amount,
      winRate: ((prev.winRate * prev.totalBets / 100) + (newBet.won ? 1 : 0)) / (prev.totalBets + 1) * 100
    }));

    // Remove the "isNew" flag after animation
    setTimeout(() => {
      setBetLogs(prev => prev.map(b => b.id === newBet.id ? { ...b, isNew: false } : b));
    }, 3000);
  }, [profiles]);

  const handleProfileChange = useCallback((profile: Record<string, unknown>) => {
    setProfiles(prev => {
      const existing = prev.findIndex(p => p.id === profile.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { 
          ...updated[existing], 
          ...profile,
          id: profile.id as string,
          email: (profile.email as string) || updated[existing].email,
          balance: (profile.balance as number) ?? updated[existing].balance,
          created_at: (profile.created_at as string) || updated[existing].created_at
        };
        return updated.sort((a, b) => b.balance - a.balance);
      }
      // Only add if we have required fields
      if (profile.id && profile.email) {
        const newProfile: Profile = {
          id: profile.id as string,
          email: profile.email as string,
          balance: (profile.balance as number) ?? 0,
          created_at: (profile.created_at as string) || new Date().toISOString(),
          display_name: profile.display_name as string | null | undefined,
          avatar_url: profile.avatar_url as string | null | undefined
        };
        return [...prev, newProfile].sort((a, b) => b.balance - a.balance);
      }
      return prev;
    });
  }, []);

  const handleTransactionChange = useCallback((tx: Record<string, unknown>, eventType: string) => {
    if (eventType === 'INSERT') {
      const player = profiles.find(p => p.id === tx.user_id);
      const newTx: Transaction = {
        id: tx.id as string,
        user_id: tx.user_id as string,
        type: tx.type as string,
        amount: tx.amount as number,
        status: tx.status as string,
        created_at: tx.created_at as string,
        user_email: player?.email || 'Unknown'
      };
      setTransactions(prev => [newTx, ...prev]);
    } else if (eventType === 'UPDATE') {
      setTransactions(prev => 
        prev.map(t => t.id === tx.id ? { ...t, ...tx } as Transaction : t)
      );
    }
  }, [profiles]);

  const handleSettingChange = useCallback((key: string, value: number) => {
    if (key === 'win_probability') {
      setGlobalWinProbability(value * 100);
    } else if (key === 'roaming_probability_enabled') {
      setRoamingEnabled(value === 1);
    } else if (key === 'auto_loss_on_increase_enabled') {
      setAutoLossOnIncreaseEnabled(value === 1);
    } else if (key.startsWith('win_probability_')) {
      const game = key.replace('win_probability_', '');
      setGameWinRates(prev => ({ ...prev, [game]: value * 100 }));
    }
    toast.info(`Setting "${key}" updated in real-time`);
  }, []);

  useBetLogsSubscription(handleNewBet, isAdmin);
  useProfilesSubscription(handleProfileChange, isAdmin);
  useTransactionsSubscription(handleTransactionChange, isAdmin);
  useGameSettingsSubscription(handleSettingChange, isAdmin);

  const fetchGameSettings = async () => {
    const { data } = await supabase
      .from('game_settings')
      .select('*');
    
    if (data) {
      const settings: Record<string, number> = {};
      data.forEach(s => {
        settings[s.setting_key] = Number(s.setting_value);
      });
      
      setGlobalWinProbability((settings['win_probability'] ?? 0.15) * 100);
      setGameWinRates({
        slots: (settings['win_probability_slots'] ?? 0.15) * 100,
        roulette: (settings['win_probability_roulette'] ?? 0.15) * 100,
        blackjack: (settings['win_probability_blackjack'] ?? 0.15) * 100,
        plinko: (settings['win_probability_plinko'] ?? 0.15) * 100,
        mines: (settings['win_probability_mines'] ?? 0.15) * 100,
      });
      setRoamingEnabled(settings['roaming_probability_enabled'] === 1);
      setAutoLossOnIncreaseEnabled(settings['auto_loss_on_increase_enabled'] === 1);
    }
  };

  const fetchUserWinRates = async () => {
    const { data } = await supabase
      .from('user_win_rates')
      .select('*');
    
    if (data) {
      setUserWinRates(data as UserWinRate[]);
    }
  };

  const fetchUserBettingControls = async () => {
    const { data } = await supabase
      .from('user_betting_controls')
      .select('*');
    
    if (data) {
      setUserBettingControls(data as UserBettingControl[]);
    }
  };

  const saveUserBettingControl = async () => {
    if (!selectedControlUserId) {
      toast.error("Please select a user");
      return;
    }

    const { error } = await supabase
      .from('user_betting_controls')
      .upsert({
        user_id: selectedControlUserId,
        max_profit_limit: maxProfitLimit,
        forced_wins_remaining: forcedWins,
        forced_losses_remaining: forcedLosses,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      toast.error("Failed to save betting control");
    } else {
      toast.success("Betting control saved!");
      fetchUserBettingControls();
      setSelectedControlUserId('');
      setMaxProfitLimit(null);
      setForcedWins(0);
      setForcedLosses(0);
    }
  };

  const removeUserBettingControl = async (userId: string) => {
    const { error } = await supabase
      .from('user_betting_controls')
      .delete()
      .eq('user_id', userId);

    if (!error) {
      toast.success("Betting control removed");
      fetchUserBettingControls();
    }
  };

  const loadUserBettingControl = (userId: string) => {
    const control = userBettingControls.find(c => c.user_id === userId);
    setSelectedControlUserId(userId);
    if (control) {
      setMaxProfitLimit(control.max_profit_limit);
      setForcedWins(control.forced_wins_remaining);
      setForcedLosses(control.forced_losses_remaining);
    } else {
      setMaxProfitLimit(null);
      setForcedWins(0);
      setForcedLosses(0);
    }
  };

  const updateGlobalWinProbability = async () => {
    const newValue = globalWinProbability / 100;
    const timestamp = new Date().toISOString();
    
    const { error: globalError } = await supabase
      .from('game_settings')
      .update({ 
        setting_value: newValue,
        updated_at: timestamp
      })
      .eq('setting_key', 'win_probability');

    if (globalError) {
      toast.error("Failed to update win probability");
      return;
    }

    const gameKeys = Object.keys(GAME_NAMES);
    const updatePromises = gameKeys.map(game => 
      supabase
        .from('game_settings')
        .update({ 
          setting_value: newValue,
          updated_at: timestamp
        })
        .eq('setting_key', `win_probability_${game}`)
    );

    await Promise.all(updatePromises);

    const newGameRates: GameWinRates = {
      slots: globalWinProbability,
      roulette: globalWinProbability,
      blackjack: globalWinProbability,
      plinko: globalWinProbability,
      mines: globalWinProbability
    };
    setGameWinRates(newGameRates);

    toast.success(`All win rates updated to ${globalWinProbability}%`);
  };

  const updateGameWinRate = async (game: string, rate: number) => {
    const { error } = await supabase
      .from('game_settings')
      .update({ 
        setting_value: rate / 100,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', `win_probability_${game}`);

    if (error) {
      toast.error(`Failed to update ${GAME_NAMES[game]} win rate`);
    } else {
      toast.success(`${GAME_NAMES[game]} win rate updated to ${rate}%`);
      setGameWinRates(prev => ({ ...prev, [game]: rate }));
    }
  };

  const toggleRoamingProbability = async (enabled: boolean) => {
    const { error } = await supabase
      .from('game_settings')
      .update({ 
        setting_value: enabled ? 1 : 0,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'roaming_probability_enabled');

    if (error) {
      toast.error("Failed to update roaming probability setting");
    } else {
      setRoamingEnabled(enabled);
      toast.success(`Roaming probability ${enabled ? 'enabled' : 'disabled'}`);
    }
  };

  const toggleAutoLossOnIncrease = async (enabled: boolean) => {
    const { error } = await supabase
      .from('game_settings')
      .update({ 
        setting_value: enabled ? 1 : 0,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'auto_loss_on_increase_enabled');

    if (error) {
      toast.error("Failed to update auto-loss setting");
    } else {
      setAutoLossOnIncreaseEnabled(enabled);
      toast.success(`Auto-loss on bet increase ${enabled ? 'enabled' : 'disabled'}`);
    }
  };

  const setUserWinRate = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    const { error } = await supabase
      .from('user_win_rates')
      .upsert({
        user_id: selectedUserId,
        game: selectedGame,
        win_probability: userSpecificRate / 100,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,game' });

    if (error) {
      toast.error("Failed to set user win rate");
    } else {
      toast.success("User-specific win rate saved!");
      fetchUserWinRates();
    }
  };

  const removeUserWinRate = async (userId: string, game: string) => {
    const { error } = await supabase
      .from('user_win_rates')
      .delete()
      .eq('user_id', userId)
      .eq('game', game);

    if (!error) {
      toast.success("User rate removed");
      fetchUserWinRates();
    }
  };

  const fetchData = async () => {
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .order('balance', { ascending: false });

    const { data: betData } = await supabase
      .from('bet_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (profileData) {
      setProfiles(profileData as Profile[]);
      
      if (txData) {
        const enrichedTx = txData.map(tx => ({
          ...tx,
          user_email: profileData.find(p => p.id === tx.user_id)?.email || 'Unknown'
        }));
        setTransactions(enrichedTx as Transaction[]);
      }

      if (betData) {
        const enrichedBets = betData.map(bet => ({
          ...bet,
          user_email: profileData.find(p => p.id === bet.user_id)?.email || 'Unknown',
          isNew: false
        }));
        setBetLogs(enrichedBets as BetLog[]);

        const totalBets = betData.length;
        const totalWagered = betData.reduce((acc, log) => acc + Number(log.bet_amount), 0);
        const wins = betData.filter(log => log.won).length;

        setStats({
          totalUsers: profileData.length,
          totalBets,
          totalWagered,
          winRate: totalBets > 0 ? (wins / totalBets) * 100 : 0
        });
      }
    }
  };

  const [processingTx, setProcessingTx] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number>(0);

  const handleApproveTransaction = async (tx: Transaction) => {
    if (processingTx === tx.id) return;
    setProcessingTx(tx.id);
    try {
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', tx.id);

      const balanceChange = tx.type === 'deposit' ? tx.amount : -tx.amount;
      await supabase.rpc('update_balance', {
        _user_id: tx.user_id,
        _amount: balanceChange
      });

      toast.success(`${tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'} approved!`);
      fetchData();
    } catch (error) {
      toast.error("Failed to approve transaction");
    } finally {
      setProcessingTx(null);
    }
  };

  const handleUpdateUserBalance = async (userId: string, balance: number) => {
    try {
      await supabase
        .from('profiles')
        .update({ balance })
        .eq('id', userId);
      toast.success("Balance updated!");
      setEditingBalance(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to update balance");
    }
  };

  const handleRejectTransaction = async (tx: Transaction) => {
    if (processingTx === tx.id) return;
    setProcessingTx(tx.id);
    try {
      await supabase
        .from('transactions')
        .update({ status: 'rejected' })
        .eq('id', tx.id);

      toast.success("Transaction rejected");
      fetchData();
    } catch (error) {
      toast.error("Failed to reject transaction");
    } finally {
      setProcessingTx(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-4xl"
        >
          ⚙️
        </motion.div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const pendingTransactions = transactions.filter(tx => tx.status === 'pending');
  const topPlayers = profiles.slice(0, 5);

  // Group bets by date
  const groupedBets = useMemo(() => {
    const groups: GroupedBets = {};
    
    betLogs.forEach((bet) => {
      const date = parseISO(bet.created_at);
      let dateKey: string;
      
      if (isToday(date)) {
        dateKey = "Today";
      } else if (isYesterday(date)) {
        dateKey = "Yesterday";
      } else {
        dateKey = format(date, "MMMM d, yyyy");
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(bet);
    });
    
    return groups;
  }, [betLogs]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-2 sm:px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl flex items-center justify-center border border-primary/30">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-gradient-gold">Admin Panel</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage transactions and control game settings</p>
            </div>
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary/20 rounded-full text-xs text-secondary"
            >
              <Activity className="w-3 h-3" />
              <span>Live</span>
            </motion.div>
          </motion.div>

          {/* Game Settings Control */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 sm:mb-8"
          >
            <Card className="border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
              <CardHeader className="border-b border-border/50 py-3 sm:py-4">
                <CardTitle className="flex items-center gap-2 text-primary text-lg sm:text-xl">
                  <Settings className="w-5 h-5" />
                  Game Control
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6 space-y-6">
                {/* Global Win Rate */}
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
                  <div className="w-full sm:flex-1 space-y-2">
                    <Label className="text-sm sm:text-base font-semibold">Global Win Probability (%)</Label>
                    <p className="text-xs text-muted-foreground">Fallback rate for all games</p>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={globalWinProbability}
                      onChange={(e) => setGlobalWinProbability(Number(e.target.value))}
                      className="max-w-[200px]"
                    />
                  </div>
                  <Button onClick={updateGlobalWinProbability} variant="gold" className="w-full sm:w-auto">
                    <Save className="w-4 h-4 mr-2" />
                    Save Global
                  </Button>
                </div>

                {/* Dynamic Win Rate Controls */}
                <div className="grid sm:grid-cols-2 gap-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Shuffle className="w-4 h-4 text-purple-400" />
                        Roaming Probability
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Win rate randomly changes (0-50%), weighted towards losses (3-4 wins per 10 bets)
                      </p>
                    </div>
                    <Switch
                      checked={roamingEnabled}
                      onCheckedChange={toggleRoamingProbability}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        Auto-Loss on Increase
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically trigger loss when user increases their bet amount
                      </p>
                    </div>
                    <Switch
                      checked={autoLossOnIncreaseEnabled}
                      onCheckedChange={toggleAutoLossOnIncrease}
                    />
                  </div>
                </div>

                {/* Per-Game Win Rates */}
                <div className="space-y-3">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4" />
                    Per-Game Win Rates
                  </Label>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(GAME_NAMES).map(([key, name]) => (
                      <motion.div 
                        key={key} 
                        className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg"
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <span className="text-sm flex-1">{name}</span>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={gameWinRates[key as keyof GameWinRates]}
                          onChange={(e) => setGameWinRates(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 px-2"
                          onClick={() => updateGameWinRate(key, gameWinRates[key as keyof GameWinRates])}
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* User-Specific Win Rates */}
                <div className="space-y-3 border-t border-border/50 pt-4">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    User-Specific Win Rate
                  </Label>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">User</Label>
                      <select 
                        className="h-9 px-3 rounded-md border border-border bg-background text-sm"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                      >
                        <option value="">Select user...</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.display_name || p.email?.split('@')[0]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Game</Label>
                      <select 
                        className="h-9 px-3 rounded-md border border-border bg-background text-sm"
                        value={selectedGame}
                        onChange={(e) => setSelectedGame(e.target.value)}
                      >
                        {Object.entries(GAME_NAMES).map(([key, name]) => (
                          <option key={key} value={key}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rate (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={userSpecificRate}
                        onChange={(e) => setUserSpecificRate(Number(e.target.value))}
                        className="w-20 h-9"
                      />
                    </div>
                    <Button onClick={setUserWinRate} variant="emerald" size="sm">
                      Set Rate
                    </Button>
                  </div>

                  {/* Active User Rates */}
                  {userWinRates.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-muted-foreground">Active User Overrides:</p>
                      <div className="flex flex-wrap gap-2">
                        {userWinRates.map((rate) => {
                          const player = profiles.find(p => p.id === rate.user_id);
                          return (
                            <motion.div 
                              key={`${rate.user_id}-${rate.game}`} 
                              className="flex items-center gap-2 px-2 py-1 bg-secondary/20 rounded text-xs"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                            >
                              <span>{player?.display_name || player?.email?.split('@')[0]}</span>
                              <span className="text-muted-foreground">•</span>
                              <span>{GAME_NAMES[rate.game]}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-secondary font-semibold">{(rate.win_probability * 100).toFixed(0)}%</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 w-5 p-0"
                                onClick={() => removeUserWinRate(rate.user_id, rate.game)}
                              >
                                <XCircle className="w-3 h-3 text-destructive" />
                              </Button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Betting Controls */}
                <div className="space-y-3 border-t border-border/50 pt-4">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    User Betting Controls
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Set max profit limits and force next N bets to be wins or losses for specific users
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">User</Label>
                      <select 
                        className="h-9 px-3 rounded-md border border-border bg-background text-sm"
                        value={selectedControlUserId}
                        onChange={(e) => loadUserBettingControl(e.target.value)}
                      >
                        <option value="">Select user...</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.display_name || p.email?.split('@')[0]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Ban className="w-3 h-3" /> Max Profit (NPR)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="No limit"
                        value={maxProfitLimit ?? ''}
                        onChange={(e) => setMaxProfitLimit(e.target.value ? Number(e.target.value) : null)}
                        className="w-28 h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1 text-secondary">
                        <Zap className="w-3 h-3" /> Forced Wins
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={forcedWins}
                        onChange={(e) => setForcedWins(Number(e.target.value))}
                        className="w-20 h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1 text-destructive">
                        <Zap className="w-3 h-3" /> Forced Losses
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={forcedLosses}
                        onChange={(e) => setForcedLosses(Number(e.target.value))}
                        className="w-20 h-9"
                      />
                    </div>
                    <Button onClick={saveUserBettingControl} variant="gold" size="sm">
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </div>

                  {/* Active Betting Controls */}
                  {userBettingControls.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-muted-foreground">Active Betting Controls:</p>
                      <div className="flex flex-wrap gap-2">
                        {userBettingControls.map((control) => {
                          const player = profiles.find(p => p.id === control.user_id);
                          return (
                            <motion.div 
                              key={control.user_id} 
                              className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg text-xs border border-primary/30"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                            >
                              <span className="font-medium">{player?.display_name || player?.email?.split('@')[0]}</span>
                              {control.max_profit_limit !== null && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-amber-400">Max: NPR {formatCredits(control.max_profit_limit)}</span>
                                </>
                              )}
                              {control.forced_wins_remaining > 0 && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-secondary">{control.forced_wins_remaining} wins</span>
                                </>
                              )}
                              {control.forced_losses_remaining > 0 && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-destructive">{control.forced_losses_remaining} losses</span>
                                </>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 w-5 p-0 ml-1"
                                onClick={() => removeUserBettingControl(control.user_id)}
                              >
                                <XCircle className="w-3 h-3 text-destructive" />
                              </Button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8"
          >
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Total Bets', value: stats.totalBets, icon: BarChart3, color: 'text-secondary', bg: 'bg-secondary/10' },
              { label: 'Total Wagered', value: `NPR ${formatCredits(stats.totalWagered)}`, icon: Coins, color: 'text-amber-400', bg: 'bg-amber-400/10' },
              { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card className="overflow-hidden border-border/50 bg-gradient-to-b from-card to-background">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <motion.div 
                        className={`p-2 sm:p-3 rounded-xl ${stat.bg} ${stat.color}`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                      >
                        <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </motion.div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                        <motion.p 
                          className="text-lg sm:text-xl font-bold truncate"
                          key={stat.value}
                          initial={{ scale: 1.2, color: 'hsl(var(--primary))' }}
                          animate={{ scale: 1, color: 'inherit' }}
                          transition={{ duration: 0.3 }}
                        >
                          {stat.value}
                        </motion.p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Pending Transactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 sm:mb-8"
          >
            <Card className="border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent">
              <CardHeader className="border-b border-border/50 py-3 sm:py-4">
                <CardTitle className="flex items-center gap-2 text-amber-400 text-lg sm:text-xl">
                  <Clock className="w-5 h-5" />
                  Pending Requests ({pendingTransactions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                {pendingTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 sm:py-8">
                    No pending requests
                  </p>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {pendingTransactions.map((tx) => (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 bg-muted/30 rounded-xl border border-border/30"
                        >
                          <div className="flex items-center gap-3">
                            {tx.type === 'deposit' ? (
                              <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                                <ArrowDownToLine className="w-5 h-5 text-secondary" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <ArrowUpFromLine className="w-5 h-5 text-primary" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium capitalize">{tx.type}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {tx.user_email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                            <p className={`font-bold text-lg ${
                              tx.type === 'deposit' ? 'text-secondary' : 'text-primary'
                            }`}>
                              NPR {tx.amount}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="emerald"
                                size="sm"
                                onClick={() => handleApproveTransaction(tx)}
                                disabled={processingTx === tx.id}
                                className="text-xs sm:text-sm"
                              >
                                <CheckCircle className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">{processingTx === tx.id ? '...' : 'Approve'}</span>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRejectTransaction(tx)}
                                disabled={processingTx === tx.id}
                                className="text-xs sm:text-sm"
                              >
                                <XCircle className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">{processingTx === tx.id ? '...' : 'Reject'}</span>
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
            {/* Top Players */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-secondary/20">
                <CardHeader className="border-b border-border/50 py-3 sm:py-4">
                  <CardTitle className="flex items-center gap-2 text-secondary text-lg sm:text-xl">
                    <TrendingUp className="w-5 h-5" />
                    Top Players
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                  {topPlayers.length > 0 ? (
                    <div className="space-y-3">
                      {topPlayers.map((player, index) => (
                        <motion.div 
                          key={player.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02, backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/30 shrink-0">
                              {index + 1}
                            </span>
                            {player.avatar_url ? (
                              <img 
                                src={player.avatar_url} 
                                alt="" 
                                className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary/30 to-secondary/10 flex items-center justify-center text-xs font-bold text-secondary border border-secondary/30 shrink-0">
                                {(player.display_name || player.email || "U").slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm truncate">
                              {player.display_name || player.email?.split('@')[0] || 'Anonymous'}
                            </span>
                          </div>
                          <motion.span 
                            className="font-semibold text-primary shrink-0 ml-2"
                            key={player.balance}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                          >
                            NPR {formatCredits(player.balance)}
                          </motion.span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 sm:py-8">
                      No users yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* All Bets - Grouped by Day */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-accent/20">
                <CardHeader className="border-b border-border/50 py-3 sm:py-4">
                  <CardTitle className="flex items-center gap-2 text-accent text-lg sm:text-xl">
                    <BarChart3 className="w-5 h-5" />
                    All Bets ({betLogs.length})
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="ml-2 text-xs text-secondary"
                    >
                      ● Live
                    </motion.span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                  {betLogs.length > 0 ? (
                    <ScrollArea className="h-[500px]" ref={betsScrollRef}>
                      <div className="space-y-4 pr-4">
                        {Object.entries(groupedBets).map(([dateKey, bets]) => (
                          <div key={dateKey}>
                            <div className="sticky top-0 bg-card/95 backdrop-blur-sm py-2 mb-2 border-b border-border/50 z-10">
                              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {dateKey}
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                  {bets.length} {bets.length === 1 ? 'bet' : 'bets'}
                                </span>
                              </h3>
                            </div>
                            <div className="space-y-2">
                              <AnimatePresence>
                                {bets.map((log) => {
                                  const player = profiles.find((p) => p.id === log.user_id);
                                  return (
                                    <motion.div 
                                      key={log.id}
                                      initial={log.isNew ? { opacity: 0, x: -50, scale: 0.9 } : false}
                                      animate={{ opacity: 1, x: 0, scale: 1 }}
                                      className={`flex items-center justify-between p-3 rounded-lg text-sm transition-all ${
                                        log.isNew 
                                          ? 'bg-primary/20 border border-primary/50 shadow-lg shadow-primary/20' 
                                          : 'bg-muted/30'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <motion.span 
                                          className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                                            log.won 
                                              ? 'bg-secondary/20 text-secondary' 
                                              : 'bg-destructive/20 text-destructive'
                                          }`}
                                          animate={log.isNew ? { scale: [1, 1.1, 1] } : {}}
                                          transition={{ repeat: log.isNew ? 2 : 0, duration: 0.3 }}
                                        >
                                          {log.won ? 'WIN' : 'LOSS'}
                                        </motion.span>
                                        {player?.avatar_url ? (
                                          <img 
                                            src={player.avatar_url} 
                                            alt="" 
                                            className="w-6 h-6 rounded-full object-cover border border-border shrink-0"
                                          />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/30 shrink-0">
                                            {(player?.display_name || player?.email || "U").slice(0, 1).toUpperCase()}
                                          </div>
                                        )}
                                        <span className="text-muted-foreground truncate">
                                          {player?.display_name || player?.email?.split("@")[0] || "Unknown"}
                                        </span>
                                        <span className="capitalize text-muted-foreground truncate">• {log.game}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {format(parseISO(log.created_at), "h:mm a")}
                                        </span>
                                      </div>
                                      <div className="text-right shrink-0 ml-2">
                                        <span className="font-medium">NPR {log.bet_amount}</span>
                                        {log.won && (
                                          <motion.span 
                                            className="text-secondary ml-2"
                                            initial={log.isNew ? { scale: 0 } : false}
                                            animate={{ scale: 1 }}
                                          >
                                            +NPR {log.payout}
                                          </motion.span>
                                        )}
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 sm:py-8">
                      No bets yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* All Users Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-primary/20">
              <CardHeader className="border-b border-border/50 py-3 sm:py-4">
                <CardTitle className="flex items-center gap-2 text-primary text-lg sm:text-xl">
                  <Users className="w-5 h-5" />
                  All Users ({profiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                {profiles.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-4">
                      <AnimatePresence>
                        {profiles.map((player) => (
                          <motion.div 
                            key={player.id}
                            className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            whileHover={{ scale: 1.01, backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {player.avatar_url ? (
                                <img 
                                  src={player.avatar_url} 
                                  alt="" 
                                  className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/30 shrink-0">
                                  {(player.display_name || player.email || "U").slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {player.display_name || player.email?.split('@')[0] || 'Anonymous'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {player.email}
                                </p>
                              </div>
                            </div>
                            {editingBalance === player.id ? (
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <Input
                                  type="number"
                                  value={newBalance}
                                  onChange={(e) => setNewBalance(Number(e.target.value))}
                                  className="w-24 h-8 text-sm"
                                  autoFocus
                                />
                                <Button size="sm" variant="emerald" onClick={() => handleUpdateUserBalance(player.id, newBalance)}>
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingBalance(null)}>
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <motion.span 
                                className="font-semibold text-primary shrink-0 ml-2 cursor-pointer hover:underline"
                                onClick={() => { setEditingBalance(player.id); setNewBalance(player.balance); }}
                                key={player.balance}
                                initial={{ scale: 1.1 }}
                                animate={{ scale: 1 }}
                              >
                                NPR {formatCredits(player.balance)}
                              </motion.span>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground py-6 sm:py-8">
                    No users yet
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
