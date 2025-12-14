import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/Header";
import { formatCredits } from "@/lib/gameUtils";
import { toast } from "sonner";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle, XCircle, Send } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
}

const WalletPage = () => {
  const { profile, user, loading } = useAuth();
  const navigate = useNavigate();
  const [depositAmount, setDepositAmount] = useState(100);
  const [withdrawAmount, setWithdrawAmount] = useState(100);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) {
      setTransactions(data as Transaction[]);
    }
  };

  const handleDepositRequest = async () => {
    if (depositAmount < 10) {
      toast.error("Minimum deposit request is NPR 10");
      return;
    }

    setProcessing(true);

    // Create pending deposit request (admin must approve)
    const { error } = await supabase.from('transactions').insert({
      user_id: user?.id,
      type: 'deposit',
      amount: depositAmount,
      status: 'pending'
    });

    if (!error) {
      toast.success("Deposit request submitted! Waiting for admin approval.");
      await fetchTransactions();
      setDepositAmount(100);
    } else {
      toast.error("Failed to submit request");
    }

    setProcessing(false);
  };

  const handleWithdrawRequest = async () => {
    if (withdrawAmount < 100) {
      toast.error("Minimum withdrawal is NPR 100");
      return;
    }

    if (!profile || withdrawAmount > profile.balance) {
      toast.error("Insufficient balance!");
      return;
    }

    setProcessing(true);

    // Create pending withdrawal request (admin must approve)
    const { error } = await supabase.from('transactions').insert({
      user_id: user?.id,
      type: 'withdrawal',
      amount: withdrawAmount,
      status: 'pending'
    });

    if (!error) {
      toast.success("Withdrawal request submitted! Waiting for admin approval.");
      await fetchTransactions();
      setWithdrawAmount(100);
    } else {
      toast.error("Failed to submit request");
    }

    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-4xl"
        >
          💰
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  const pendingDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'pending');
  const pendingWithdrawals = transactions.filter(t => t.type === 'withdrawal' && t.status === 'pending');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-20 sm:pt-24 pb-8 sm:pb-12 px-2 sm:px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6 sm:mb-8"
          >
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              <span className="text-gradient-gold">Wallet</span>
            </h1>
            <div className="inline-flex items-center gap-3 sm:gap-4 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-card to-card/80 rounded-2xl border border-primary/30 shadow-lg">
              <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              <div className="text-left">
                <p className="text-xs sm:text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl sm:text-3xl font-display font-bold text-primary">
                  NPR {formatCredits(profile?.balance ?? 0)}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Pending Requests Summary */}
          {(pendingDeposits.length > 0 || pendingWithdrawals.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 sm:mb-6 p-3 sm:p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
            >
              <p className="text-amber-400 text-xs sm:text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                You have {pendingDeposits.length + pendingWithdrawals.length} pending request(s) awaiting admin approval
              </p>
            </motion.div>
          )}

          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 bg-muted/50">
              <TabsTrigger value="deposit" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-secondary/20">
                <ArrowDownToLine className="w-3 h-3 sm:w-4 sm:h-4" />
                Request Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="gap-1 sm:gap-2 text-xs sm:text-sm data-[state=active]:bg-primary/20">
                <ArrowUpFromLine className="w-3 h-3 sm:w-4 sm:h-4" />
                Request Withdraw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              <Card className="border-secondary/20 bg-gradient-to-b from-card to-background">
                <CardHeader className="border-b border-border/50 py-4 sm:py-6">
                  <CardTitle className="font-display text-secondary text-lg sm:text-xl">Request Deposit</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Submit a deposit request. Admin will review and approve your request.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 p-4 sm:p-6">
                  <div className="space-y-2">
                    <Label className="text-sm">Amount (Minimum NPR 10)</Label>
                    <Input
                      type="number"
                      min={10}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="bg-muted/50"
                    />
                    <div className="grid grid-cols-5 gap-1 sm:gap-2">
                      {[100, 250, 500, 1000, 2500].map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => setDepositAmount(amount)}
                          className="text-xs sm:text-sm px-1 sm:px-2"
                        >
                          {amount}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button 
                    variant="emerald" 
                    size="lg" 
                    className="w-full text-sm sm:text-base"
                    onClick={handleDepositRequest}
                    disabled={processing || depositAmount < 10}
                  >
                    {processing ? 'Submitting...' : (
                      <>
                        <Send className="w-4 h-4" />
                        Request NPR {depositAmount} Deposit
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Admin approval required for all transactions.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw">
              <Card className="border-primary/20 bg-gradient-to-b from-card to-background">
                <CardHeader className="border-b border-border/50 py-4 sm:py-6">
                  <CardTitle className="font-display text-primary text-lg sm:text-xl">Request Withdrawal</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Submit a withdrawal request. Admin will review and process your request.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6 p-4 sm:p-6">
                  <div className="space-y-2">
                    <Label className="text-sm">Amount (Minimum NPR 100)</Label>
                    <Input
                      type="number"
                      min={100}
                      max={profile?.balance ?? 0}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                      className="bg-muted/50"
                    />
                    <div className="grid grid-cols-4 gap-1 sm:gap-2">
                      {[100, 500, 1000].map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => setWithdrawAmount(amount)}
                          disabled={(profile?.balance ?? 0) < amount}
                          className="text-xs sm:text-sm px-1 sm:px-2"
                        >
                          {amount}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWithdrawAmount(profile?.balance ?? 0)}
                        className="text-xs sm:text-sm px-1 sm:px-2"
                      >
                        Max
                      </Button>
                    </div>
                  </div>

                  <Button 
                    variant="gold" 
                    size="lg" 
                    className="w-full text-sm sm:text-base"
                    onClick={handleWithdrawRequest}
                    disabled={processing || withdrawAmount < 100 || (profile?.balance ?? 0) < withdrawAmount}
                  >
                    {processing ? 'Submitting...' : (
                      <>
                        <Send className="w-4 h-4" />
                        Request NPR {withdrawAmount} Withdrawal
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Admin approval required for all withdrawals.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Transaction History */}
          <Card className="mt-6 sm:mt-8 border-border/50">
            <CardHeader className="border-b border-border/50 py-4 sm:py-6">
              <CardTitle className="font-display flex items-center gap-2 text-lg sm:text-xl">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                  No transactions yet
                </p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 rounded-xl border border-border/30"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {tx.type === 'deposit' ? (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                            <ArrowDownToLine className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <ArrowUpFromLine className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium capitalize text-sm sm:text-base">{tx.type} Request</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`font-semibold text-sm sm:text-base ${
                          tx.type === 'deposit' ? 'text-secondary' : 'text-primary'
                        }`}>
                          {tx.type === 'deposit' ? '+' : '-'}NPR {tx.amount}
                        </p>
                        <div className="flex items-center gap-1 text-xs sm:text-sm justify-end">
                          {tx.status === 'completed' && (
                            <>
                              <CheckCircle className="w-3 h-3 text-secondary" />
                              <span className="text-secondary">Approved</span>
                            </>
                          )}
                          {tx.status === 'pending' && (
                            <>
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span className="text-amber-400">Pending</span>
                            </>
                          )}
                          {tx.status === 'rejected' && (
                            <>
                              <XCircle className="w-3 h-3 text-destructive" />
                              <span className="text-destructive">Rejected</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default WalletPage;