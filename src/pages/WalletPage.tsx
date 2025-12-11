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
import { Disclaimer } from "@/components/layout/Disclaimer";
import { formatCredits } from "@/lib/gameUtils";
import { toast } from "sonner";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle, XCircle, CreditCard, Building } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
}

const WalletPage = () => {
  const { profile, user, loading, refreshProfile } = useAuth();
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

  const handleDeposit = async () => {
    if (depositAmount < 10) {
      toast.error("Minimum deposit is $10");
      return;
    }

    setProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Create transaction record
    await supabase.from('transactions').insert({
      user_id: user?.id,
      type: 'deposit',
      amount: depositAmount,
      status: 'completed'
    });

    // Update balance
    const { data, error } = await supabase.rpc('update_balance', {
      _user_id: user?.id,
      _amount: depositAmount
    });

    if (!error) {
      toast.success(`Successfully deposited $${depositAmount}!`);
      await refreshProfile();
      await fetchTransactions();
    }

    setProcessing(false);
  };

  const handleWithdraw = async () => {
    if (withdrawAmount < 100) {
      toast.error("Minimum withdrawal is $100");
      return;
    }

    if (!profile || withdrawAmount > profile.balance) {
      toast.error("Insufficient balance!");
      return;
    }

    setProcessing(true);

    // Create pending transaction
    await supabase.from('transactions').insert({
      user_id: user?.id,
      type: 'withdrawal',
      amount: withdrawAmount,
      status: 'pending'
    });

    // Deduct balance immediately
    await supabase.rpc('update_balance', {
      _user_id: user?.id,
      _amount: -withdrawAmount
    });

    toast.success("Withdrawal request submitted! Processing in 1-3 business days.");
    await refreshProfile();
    await fetchTransactions();
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-display font-bold mb-4">
              <span className="text-gradient-gold">Wallet</span>
            </h1>
            <div className="inline-flex items-center gap-4 px-8 py-4 bg-card rounded-xl border border-border glow-gold">
              <Wallet className="w-8 h-8 text-primary" />
              <div className="text-left">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-3xl font-display font-bold text-primary">
                  ${formatCredits(profile?.balance ?? 0)}
                </p>
              </div>
            </div>
          </motion.div>

          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="deposit" className="gap-2">
                <ArrowDownToLine className="w-4 h-4" />
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="gap-2">
                <ArrowUpFromLine className="w-4 h-4" />
                Withdraw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              <Card glow="emerald">
                <CardHeader>
                  <CardTitle className="font-display">Deposit Funds</CardTitle>
                  <CardDescription>
                    Add funds to your account (Simulated - No real money)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Amount (Minimum $10)</Label>
                    <Input
                      type="number"
                      min={10}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
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

                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-20 flex-col gap-2">
                      <CreditCard className="w-6 h-6" />
                      <span>Card</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-2">
                      <Building className="w-6 h-6" />
                      <span>Bank</span>
                    </Button>
                  </div>

                  <Button 
                    variant="emerald" 
                    size="lg" 
                    className="w-full"
                    onClick={handleDeposit}
                    disabled={processing || depositAmount < 10}
                  >
                    {processing ? 'Processing...' : `Deposit $${depositAmount}`}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    ⚠️ This is a simulation. No real money will be charged.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdraw">
              <Card glow="gold">
                <CardHeader>
                  <CardTitle className="font-display">Withdraw Funds</CardTitle>
                  <CardDescription>
                    Request a withdrawal (Simulated - Processing time: 1-3 days)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Amount (Minimum $100)</Label>
                    <Input
                      type="number"
                      min={100}
                      max={profile?.balance ?? 0}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value))}
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
                    onClick={handleWithdraw}
                    disabled={processing || withdrawAmount < 100 || (profile?.balance ?? 0) < withdrawAmount}
                  >
                    {processing ? 'Processing...' : `Withdraw $${withdrawAmount}`}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    ⚠️ This is a simulation. No real money will be transferred.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Transaction History */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No transactions yet
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {tx.type === 'deposit' ? (
                          <ArrowDownToLine className="w-5 h-5 text-secondary" />
                        ) : (
                          <ArrowUpFromLine className="w-5 h-5 text-primary" />
                        )}
                        <div>
                          <p className="font-medium capitalize">{tx.type}</p>
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
                              <span className="text-secondary">Completed</span>
                            </>
                          )}
                          {tx.status === 'pending' && (
                            <>
                              <Clock className="w-3 h-3 text-primary" />
                              <span className="text-primary">Pending</span>
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

      <Disclaimer />
    </div>
  );
};

export default WalletPage;
