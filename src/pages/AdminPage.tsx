import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Disclaimer } from "@/components/layout/Disclaimer";
import { formatCredits } from "@/lib/gameUtils";
import { 
  Users, 
  TrendingUp, 
  Coins, 
  BarChart3, 
  RefreshCw,
  Power,
  PowerOff,
  Shield
} from "lucide-react";

const AdminPage = () => {
  const { currentUser, getAllUsers, getStats, getBetLogs, games, toggleGame, resetUserBalance } = useGameStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser?.isAdmin) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  if (!currentUser?.isAdmin) return null;

  const users = getAllUsers();
  const stats = getStats();
  const betLogs = getBetLogs().slice(0, 50);

  const topPlayers = [...users]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-8"
          >
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-gradient-gold">Admin Panel</h1>
              <p className="text-muted-foreground">Manage games, users, and view statistics</p>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary' },
              { label: 'Total Bets', value: stats.totalBets, icon: BarChart3, color: 'text-secondary' },
              { label: 'Total Wagered', value: formatCredits(stats.totalWagered), icon: Coins, color: 'text-amber-400' },
              { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-400' },
            ].map((stat, index) => (
              <Card key={stat.label} glow="none" className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Game Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card glow="gold">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Power className="w-5 h-5 text-primary" />
                    Game Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {games.map((game) => (
                    <div 
                      key={game.id}
                      className="flex items-center justify-between p-4 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-semibold">{game.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Bet: {game.minBet} - {formatCredits(game.maxBet)}
                        </p>
                      </div>
                      <Button
                        variant={game.enabled ? 'emerald' : 'destructive'}
                        size="sm"
                        onClick={() => toggleGame(game.id)}
                      >
                        {game.enabled ? (
                          <>
                            <Power className="w-4 h-4" />
                            Enabled
                          </>
                        ) : (
                          <>
                            <PowerOff className="w-4 h-4" />
                            Disabled
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Top Players */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card glow="emerald">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-secondary" />
                    Top Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topPlayers.length > 0 ? (
                    <div className="space-y-3">
                      {topPlayers.map((user, index) => (
                        <div 
                          key={user.id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                              {index + 1}
                            </span>
                            <span className="text-sm truncate max-w-[150px]">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">
                              {formatCredits(user.balance)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => resetUserBalance(user.id)}
                              title="Reset balance to 10,000"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
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
              className="lg:col-span-2"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-accent" />
                    Recent Bet History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {betLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">User</th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Game</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Bet</th>
                            <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Result</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Payout</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {betLogs.map((log) => (
                            <tr key={log.id} className="border-b border-border/50 hover:bg-muted/50">
                              <td className="py-3 px-2 text-sm truncate max-w-[120px]">{log.odamEmail}</td>
                              <td className="py-3 px-2 text-sm capitalize">{log.game}</td>
                              <td className="py-3 px-2 text-sm text-right">{formatCredits(log.betAmount)}</td>
                              <td className="py-3 px-2 text-center">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  log.won 
                                    ? 'bg-secondary/20 text-secondary' 
                                    : 'bg-destructive/20 text-destructive'
                                }`}>
                                  {log.won ? 'WIN' : 'LOSS'}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-sm text-right text-secondary">
                                +{formatCredits(log.payout)}
                              </td>
                              <td className="py-3 px-2 text-sm text-right text-muted-foreground">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No bets placed yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
};

export default AdminPage;
