import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, User, AlertCircle, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const WaiterLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { signIn, user, role, loading: authLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in as waiter/admin
  useEffect(() => {
    if (!authLoading && user && role) {
      if (role === 'waiter_staff') navigate('/waiter', { replace: true });
      else if (role === 'restaurant_admin') navigate('/admin', { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);

    try {
      // Try direct email first; if no @, resolve username → email via employees table
      let loginEmail = username.trim();

      if (!loginEmail.includes('@')) {
        // Resolve username → faux email via security-definer RPC
        const { data: resolvedEmail } = await supabase
          .rpc('resolve_staff_email', { p_username: loginEmail });

        if (!resolvedEmail) {
          setError('Username not found. Please contact your manager.');
          setLoading(false);
          return;
        }
        loginEmail = resolvedEmail as string;
      }

      const { error: signInError } = await signIn(loginEmail, password);

      if (signInError) {
        const isNetworkError =
          signInError.message === 'Failed to fetch' ||
          signInError.message?.includes('NetworkError');
        setError(
          isNetworkError
            ? 'Network error. Please check your connection.'
            : 'Incorrect username or password.'
        );
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-[90px]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 mb-4">
            <UtensilsCrossed className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Staff Login</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your waiter dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="pl-9 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm tracking-wide transition-all mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="text-center text-slate-500 text-xs mt-5">
          Forgot your password? Contact your restaurant manager.
        </p>
      </motion.div>
    </div>
  );
};

export default WaiterLogin;
