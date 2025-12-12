import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/layout/Header";
import { formatCredits } from "@/lib/gameUtils";
import { toast } from "sonner";
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
  Save
} from "lucide-react";

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
}

const AdminPage = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [betLogs, setBetLogs] = useState<BetLog[]>([]);
  const [winProbability, setWinProbability] = useState(15);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBets: 0,
    totalWagered: 0,
    winRate: 0
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
      fetchGameSettings();
    }
  }, [isAdmin]);

  const fetchGameSettings = async () => {
    const { data } = await supabase
      .from('game_settings')
      .select('*')
      .eq('setting_key', 'win_probability')
      .single();
    
    if (data) {
      setWinProbability(Number(data.setting_value) * 100);
    }
  };

  const updateWinProbability = async () => {
    const { error } = await supabase
      .from('game_settings')
      .update({ 
        setting_value: winProbability / 100,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'win_probability');

    if (error) {
      toast.error("Failed to update win probability");
    } else {
      toast.success(`Win probability updated to ${winProbability}%`);
    }
  };

  const fetchData = async () => {
    // Fetch pending transactions
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch all profiles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .order('balance', { ascending: false });

    // Fetch bet logs
    const { data: betData } = await supabase
      .from('bet_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (profileData) {
      setProfiles(profileData as Profile[]);
      
      // Enrich transactions with emails
      if (txData) {
        const enrichedTx = txData.map(tx => ({
          ...tx,
          user_email: profileData.find(p => p.id === tx.user_id)?.email || 'Unknown'
        }));
        setTransactions(enrichedTx as Transaction[]);
      }

      // Enrich bet logs with emails
      if (betData) {
        const enrichedBets = betData.map(bet => ({
          ...bet,
          user_email: profileData.find(p => p.id === bet.user_id)?.email || 'Unknown'
        }));
        setBetLogs(enrichedBets as BetLog[]);

        // Calculate stats
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

  const handleApproveTransaction = async (tx: Transaction) => {
    try {
      // Update transaction status
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', tx.id);

      // Update user balance
      const balanceChange = tx.type === 'deposit' ? tx.amount : -tx.amount;
      await supabase.rpc('update_balance', {
        _user_id: tx.user_id,
        _amount: balanceChange
      });

      toast.success(`${tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'} approved!`);
      fetchData();
    } catch (error) {
      toast.error("Failed to approve transaction");
    }
  };

  const handleRejectTransaction = async (tx: Transaction) => {
    try {
      await supabase
        .from('transactions')
        .update({ status: 'rejected' })
        .eq('id', tx.id);

      toast.success("Transaction rejected");
      fetchData();
    } catch (error) {
      toast.error("Failed to reject transaction");
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
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-gradient-gold">Admin Panel</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage transactions and control game settings</p>
            </div>
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
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
                  <div className="w-full sm:flex-1 space-y-2">
                    <Label className="text-sm sm:text-base">Win Probability (%)</Label>
                    <p className="text-xs text-muted-foreground">Controls how often players win across all games</p>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={winProbability}
                      onChange={(e) => setWinProbability(Number(e.target.value))}
                      className="max-w-[200px]"
                    />
                  </div>
                  <Button onClick={updateWinProbability} variant="gold" className="w-full sm:w-auto">
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </Button>
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
            ].map((stat) => (
              <Card key={stat.label} className="overflow-hidden border-border/50 bg-gradient-to-b from-card to-background">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-2 sm:p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                      <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                      <p className="text-lg sm:text-xl font-bold truncate">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Pending Transactions - Most Important */}
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
                    {pendingTransactions.map((tx) => (
                      <div
                        key={tx.id}
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
                              className="text-xs sm:text-sm"
                            >
                              <CheckCircle className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Approve</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRejectTransaction(tx)}
                              className="text-xs sm:text-sm"
                            >
                              <XCircle className="w-4 h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Reject</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-8">
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
                        <div 
                          key={player.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/30 shrink-0">
                              {index + 1}
                            </span>
                            <span className="text-sm truncate">{player.email}</span>
                          </div>
                          <span className="font-semibold text-primary shrink-0 ml-2">
                            NPR {formatCredits(player.balance)}
                          </span>
                        </div>
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

            {/* Recent Bets */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-accent/20">
                <CardHeader className="border-b border-border/50 py-3 sm:py-4">
                  <CardTitle className="flex items-center gap-2 text-accent text-lg sm:text-xl">
                    <BarChart3 className="w-5 h-5" />
                    Recent Bets
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                  {betLogs.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {betLogs.slice(0, 10).map((log) => (
                        <div 
                          key={log.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                              log.won 
                                ? 'bg-secondary/20 text-secondary' 
                                : 'bg-destructive/20 text-destructive'
                            }`}>
                              {log.won ? 'WIN' : 'LOSS'}
                            </span>
                            <span className="capitalize text-muted-foreground truncate">{log.game}</span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-medium">NPR {log.bet_amount}</span>
                            {log.won && (
                              <span className="text-secondary ml-2">+NPR {log.payout}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6 sm:py-8">
                      No bets yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;