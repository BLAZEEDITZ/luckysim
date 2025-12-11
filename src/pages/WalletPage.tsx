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
  const [depositAmount, setDepositAmount] = useState(10);
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
      toast.error("Minimum deposit request is $10");
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
      setDepositAmount(10);
    } else {
      toast.error("Failed to submit request");
    }

    setProcessing(false);
  };

  const handleWithdrawRequest = async () => {
    if (withdrawAmount < 100) {
      toast.error("Minimum withdrawal is $100");
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
      
      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-display font-bold mb-4">
              <span className="text-gradient-gold">Wallet</span>
            </h1>
            <div className="inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-card to-card/80 rounded-2xl border border-primary/30 shadow-lg">
              <Wallet className="w-8 h-8 text-primary" />
              <div className="text-left">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-3xl font-display font-bold text-primary">
                  ${formatCredits(profile?.balance ?? 0)}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Pending Requests Summary */}
          {(pendingDeposits.length > 0 || pendingWithdrawals.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
            >
              <p className="text-amber-400 text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                You have {pendingDeposits.length + pendingWithdrawals.length} pending request(s) awaiting admin approval
              </p>
            </motion.div>
          )}

          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
              <TabsTrigger value="deposit" className="gap-2 data-[state=active]:bg-secondary/20">
                <ArrowDownToLine className="w-4 h-4" />
                Request Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="gap-2 data-[state=active]:bg-primary/20">
                <ArrowUpFromLine className="w-4 h-4" />
                Request Withdraw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              <Card className="border-secondary/20 bg-gradient-to-b from-card to-background">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="font-display text-secondary">Request Deposit</CardTitle>
                  <CardDescription>
                    Submit a deposit request. Admin will review and approve your request.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label>Amount (Minimum $10)</Label>
                    <Input
                      type="number"
                      min={10}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      className="bg-muted/50"
                    />
                    <div className="flex gap-2">
                      {[10, 25, 50, 100, 250].map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => setDepositAmount(amount)}
                          className="flex-1"
                        >
                          ${amount}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button 
                    variant="emerald" 
                    size="lg" 
                    className="w-full"
                    onClick={handleDepositRequest}
                    disabled={processing || depositAmount < 10}
                  >
                    {processing ? 'Submitting...' : (
                      <>
                        <Send className="w-4 h-4" />
                        Request ${depositAmount} Deposit
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    ⚠️ This is a simulation. Admin approval required.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw">
              <Card className="border-primary/20 bg-gradient-to-b from-card to-background">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="font-display text-primary">Request Withdrawal</CardTitle>
                  <CardDescription>
                    Submit a withdrawal request. Admin will review and process your request.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label>Amount (Minimum $100)</Label>
                    <Input
                      type="number"
                      min={100}
                      max={profile?.balance ?? 0}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                      className="bg-muted/50"
                    />
                    <div className="flex gap-2">
                      {[100, 250, 500].map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => setWithdrawAmount(amount)}
                          disabled={(profile?.balance ?? 0) < amount}
                          className="flex-1"
                        >
                          ${amount}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWithdrawAmount(profile?.balance ?? 0)}
                        className="flex-1"
                      >
                        Max
                      </Button>
                    </div>
                  </div>

                  <Button 
                    variant="gold" 
                    size="lg" 
                    className="w-full"
                    onClick={handleWithdrawRequest}
                    disabled={processing || withdrawAmount < 100 || (profile?.balance ?? 0) < withdrawAmount}
                  >
                    {processing ? 'Submitting...' : (
                      <>
                        <Send className="w-4 h-4" />
                        Request ${withdrawAmount} Withdrawal
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    ⚠️ This is a simulation. Admin approval required.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Transaction History */}
          <Card className="mt-8 border-border/50">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="font-display flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No transactions yet
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        {tx.type === 'deposit' ? (
                          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                            <ArrowDownToLine className="w-5 h-5 text-secondary" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <ArrowUpFromLine className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium capitalize">{tx.type} Request</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          tx.type === 'deposit' ? 'text-secondary' : 'text-primary'
                        }`}>
                          {tx.type === 'deposit' ? '+' : '-'}${tx.amount}
                        </p>
                        <div className="flex items-center gap-1 text-sm">
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
