import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { useGameStore } from "@/store/gameStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/layout/Header";
import { Disclaimer } from "@/components/layout/Disclaimer";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Coins } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'login' ? 'login' : 'register'
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const { login, register } = useGameStore();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const result = mode === 'login' 
      ? login(email, password)
      : register(email, password);
    
    setLoading(false);
    
    if (result.success) {
      toast.success(result.message);
      navigate('/games');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card glow="gold" className="overflow-hidden">
              <CardHeader className="text-center bg-gradient-to-b from-primary/10 to-transparent pb-8">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="text-5xl mb-4"
                >
                  🎰
                </motion.div>
                <CardTitle className="text-2xl font-display text-gradient-gold">
                  {mode === 'login' ? 'Welcome Back!' : 'Join LuckySim'}
                </CardTitle>
                <CardDescription>
                  {mode === 'login' 
                    ? 'Sign in to continue playing' 
                    : 'Create an account to start with 10,000 free credits!'}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6 p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  
                  <Button 
                    variant="gold" 
                    size="lg" 
                    className="w-full mt-6"
                    disabled={loading}
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1 }}
                      >
                        ⏳
                      </motion.div>
                    ) : (
                      <>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                </form>

                {mode === 'register' && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-secondary/20 rounded-lg border border-secondary/30">
                    <Coins className="w-5 h-5 text-secondary" />
                    <span className="text-sm font-medium text-secondary">
                      Get 10,000 free credits on signup!
                    </span>
                  </div>
                )}
                
                <div className="text-center pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {mode === 'login' 
                      ? "Don't have an account? Sign up" 
                      : 'Already have an account? Sign in'}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground">
                    Demo Admin: admin@luckysim.com / SecurePass123!
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
};

export default AuthPage;
