import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { formatCredits } from "@/lib/gameUtils";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LeaderboardPlayer {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_winnings: number;
  total_bets: number;
  win_count: number;
}

const LeaderboardPage = () => {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Fetch all bet logs
      const { data: betLogs } = await supabase
        .from("bet_logs")
        .select("user_id, bet_amount, won, payout");

      // Fetch all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, email");

      if (betLogs && profiles) {
        // Aggregate winnings per user
        const userStats: Record<string, { winnings: number; bets: number; wins: number }> = {};
        
        betLogs.forEach((log) => {
          if (!userStats[log.user_id]) {
            userStats[log.user_id] = { winnings: 0, bets: 0, wins: 0 };
          }
          userStats[log.user_id].bets += 1;
          if (log.won) {
            userStats[log.user_id].winnings += Number(log.payout) - Number(log.bet_amount);
            userStats[log.user_id].wins += 1;
          } else {
            userStats[log.user_id].winnings -= Number(log.bet_amount);
          }
        });

        // Create leaderboard
        const leaderboard: LeaderboardPlayer[] = profiles
          .map((profile) => ({
            id: profile.id,
            display_name: profile.display_name || profile.email?.split("@")[0] || "Anonymous",
            avatar_url: profile.avatar_url,
            total_winnings: userStats[profile.id]?.winnings || 0,
            total_bets: userStats[profile.id]?.bets || 0,
            win_count: userStats[profile.id]?.wins || 0,
          }))
          .filter((p) => p.total_bets > 0)
          .sort((a, b) => b.total_winnings - a.total_winnings);

        setPlayers(leaderboard);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (rank === 1) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 2) return <Award className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank + 1}</span>;
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-4xl"
        >
          🏆
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-2 sm:px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-500/30 to-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/30">
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-gradient-gold">
                Leaderboard
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Top players by total winnings
              </p>
            </div>
          </motion.div>

          <Card className="border-primary/20">
            <CardHeader className="py-3 sm:py-4 border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <TrendingUp className="w-5 h-5 text-primary" />
                Rankings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {players.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {players.map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-3 sm:p-4 rounded-xl ${
                        index === 0
                          ? "bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30"
                          : index === 1
                          ? "bg-gradient-to-r from-gray-400/20 to-gray-400/5 border border-gray-400/30"
                          : index === 2
                          ? "bg-gradient-to-r from-amber-600/20 to-amber-600/5 border border-amber-600/30"
                          : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                          {getRankIcon(index)}
                        </div>
                        <Avatar className="w-10 h-10 border-2 border-primary/30 shrink-0">
                          <AvatarImage src={player.avatar_url || ""} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-xs font-bold text-primary">
                            {getInitials(player.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {player.display_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {player.total_bets} bets • {player.win_count} wins
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p
                          className={`font-bold text-lg ${
                            player.total_winnings >= 0
                              ? "text-secondary"
                              : "text-destructive"
                          }`}
                        >
                          {player.total_winnings >= 0 ? "+" : ""}
                          NPR {formatCredits(Math.abs(player.total_winnings))}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No players on the leaderboard yet. Start playing to appear here!
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default LeaderboardPage;
