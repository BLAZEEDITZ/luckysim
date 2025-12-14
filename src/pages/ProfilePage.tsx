import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/layout/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCredits } from "@/lib/gameUtils";
import { toast } from "sonner";
import { User, Camera, Save, Coins, Calendar, Mail, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday, parseISO } from "date-fns";

interface BetLog {
  id: string;
  game: string;
  bet_amount: number;
  won: boolean;
  payout: number;
  created_at: string;
}

interface GroupedBets {
  [key: string]: BetLog[];
}

const ProfilePage = () => {
  const { user, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [betLogs, setBetLogs] = useState<BetLog[]>([]);
  const [pnl, setPnl] = useState({ profit: 0, loss: 0, net: 0, totalBets: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchUserBets();
    }
  }, [user]);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile?.display_name]);

  const fetchUserBets = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("bet_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setBetLogs(data);

      // Calculate PnL
      let profit = 0;
      let loss = 0;

      data.forEach((log) => {
        if (log.won) {
          profit += Number(log.payout) - Number(log.bet_amount);
        } else {
          loss += Number(log.bet_amount);
        }
      });

      setPnl({
        profit,
        loss,
        net: profit - loss,
        totalBets: data.length,
      });
    }
  };

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

  if (!loading && !user) {
    navigate("/auth");
    return null;
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);

      await refreshProfile();
      toast.success("Avatar updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const trimmedName = displayName.trim();
      if (trimmedName.length > 50) {
        toast.error("Display name must be 50 characters or less");
        return;
      }

      await supabase
        .from("profiles")
        .update({ display_name: trimmedName || null })
        .eq("id", user.id);

      await refreshProfile();
      toast.success("Profile updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    if (profile?.email) {
      return profile.email.slice(0, 2).toUpperCase();
    }
    return "U";
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
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl flex items-center justify-center border border-primary/30">
              <User className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-gradient-gold">
                My Profile
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Manage your account settings
              </p>
            </div>
          </motion.div>

          <div className="space-y-4 sm:space-y-6">
            {/* Avatar & Name Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-primary/20">
                <CardHeader className="py-3 sm:py-4">
                  <CardTitle className="text-lg sm:text-xl">Profile Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-4 sm:p-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-primary/30">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-2xl sm:text-3xl font-bold text-primary">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 p-2 bg-primary rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4 text-primary-foreground" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    {uploading && (
                      <p className="text-sm text-muted-foreground">
                        Uploading...
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="Enter your display name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={50}
                    />
                    <p className="text-xs text-muted-foreground">
                      This name will be shown on the leaderboard
                    </p>
                  </div>

                  <Button
                    variant="gold"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* PnL Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="border-accent/20">
                <CardHeader className="py-3 sm:py-4">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <BarChart3 className="w-5 h-5 text-accent" />
                    Profit & Loss
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-secondary/10 rounded-xl text-center">
                      <TrendingUp className="w-5 h-5 text-secondary mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Profit</p>
                      <p className="font-bold text-secondary">
                        NPR {formatCredits(pnl.profit)}
                      </p>
                    </div>
                    <div className="p-3 bg-destructive/10 rounded-xl text-center">
                      <TrendingDown className="w-5 h-5 text-destructive mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">Loss</p>
                      <p className="font-bold text-destructive">
                        NPR {formatCredits(pnl.loss)}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl text-center ${pnl.net >= 0 ? 'bg-secondary/10' : 'bg-destructive/10'}`}>
                      <BarChart3 className={`w-5 h-5 mx-auto mb-1 ${pnl.net >= 0 ? 'text-secondary' : 'text-destructive'}`} />
                      <p className="text-xs text-muted-foreground">Net P&L</p>
                      <p className={`font-bold ${pnl.net >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                        {pnl.net >= 0 ? '+' : ''}NPR {formatCredits(pnl.net)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Based on last {pnl.totalBets} bets
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Account Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-secondary/20">
                <CardHeader className="py-3 sm:py-4">
                  <CardTitle className="text-lg sm:text-xl">
                    Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium truncate">{profile?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="p-2 bg-secondary/20 rounded-lg">
                      <Coins className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-bold text-secondary">
                        NPR {formatCredits(profile?.balance ?? 0)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="p-2 bg-accent/20 rounded-lg">
                      <Calendar className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Member Since
                      </p>
                      <p className="font-medium">
                        {profile?.created_at
                          ? new Date(profile.created_at).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Bets - Grouped by Day */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="border-accent/20">
                <CardHeader className="py-3 sm:py-4">
                  <CardTitle className="text-lg sm:text-xl">
                    My Betting History ({betLogs.length} bets)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {betLogs.length > 0 ? (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                      {Object.entries(groupedBets).map(([dateKey, bets]) => (
                        <div key={dateKey}>
                          <div className="sticky top-0 bg-card/95 backdrop-blur-sm py-2 mb-2 border-b border-border/50">
                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {dateKey}
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                {bets.length} {bets.length === 1 ? 'bet' : 'bets'}
                              </span>
                            </h3>
                          </div>
                          <div className="space-y-2">
                            {bets.map((log) => (
                              <div
                                key={log.id}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                                      log.won
                                        ? "bg-secondary/20 text-secondary"
                                        : "bg-destructive/20 text-destructive"
                                    }`}
                                  >
                                    {log.won ? "WIN" : "LOSS"}
                                  </span>
                                  <span className="capitalize text-muted-foreground truncate">
                                    {log.game}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {format(parseISO(log.created_at), "h:mm a")}
                                  </span>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <span className="font-medium">NPR {log.bet_amount}</span>
                                  {log.won && (
                                    <span className="text-secondary ml-2">
                                      +NPR {log.payout}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-6">
                      No bets yet. Start playing to see your history!
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

export default ProfilePage;
