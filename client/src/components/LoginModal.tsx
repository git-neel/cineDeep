import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { requestLogin, verifyToken } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'email' | 'verify' | 'display-name' | 'success';

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  const handleRequestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await requestLogin(email);
      setToken(response.token);
      setIsNewUser(response.isNewUser);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // For new users, first attempt without displayName to check if account exists
      const response = await verifyToken(token);
      login(response.sessionId, response.user);
      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      if (err.message?.includes('Display name is required') || err.message?.includes('needsDisplayName')) {
        setStep('display-name');
        setError('');
      } else {
        setError(err.message || 'Invalid verification code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await verifyToken(token, displayName.trim());
      login(response.sessionId, response.user);
      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('email');
    setEmail('');
    setToken('');
    setDisplayName('');
    setError('');
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-zinc-400 hover:text-white transition-colors"
            data-testid="button-close-login"
          >
            <X size={20} />
          </button>

          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="text-amber-500" size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Sign In to CineDeep</h2>
                  <p className="text-zinc-400 text-sm">Join the conversation about cinema</p>
                </div>

                <form onSubmit={handleRequestLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                      data-testid="input-email"
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm" data-testid="text-error">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !email}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    data-testid="button-continue"
                  >
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        Continue
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-zinc-500 text-xs mt-4">
                  No password required. We'll send you a magic link.
                </p>
              </motion.div>
            )}

            {step === 'verify' && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-emerald-500" size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Check Your Email</h2>
                  <p className="text-zinc-400 text-sm">
                    We sent a verification link to <span className="text-white">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Or paste your verification code
                    </label>
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Paste code here"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 font-mono"
                      data-testid="input-token"
                    />
                    <p className="text-xs text-zinc-500 mt-2">
                      Dev mode: The token is shown in response. Use it above.
                    </p>
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm" data-testid="text-error">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !token}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    data-testid="button-verify"
                  >
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        Verify
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                <button
                  onClick={() => setStep('email')}
                  className="w-full text-zinc-400 hover:text-white text-sm mt-4 transition-colors"
                  data-testid="button-back"
                >
                  Use different email
                </button>
              </motion.div>
            )}

            {step === 'display-name' && (
              <motion.div
                key="display-name"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white mb-2">Welcome!</h2>
                  <p className="text-zinc-400 text-sm">Choose a display name for discussions</p>
                </div>

                <form onSubmit={handleSetDisplayName} className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Film Enthusiast"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                      data-testid="input-display-name"
                      minLength={2}
                      maxLength={50}
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm" data-testid="text-error">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !displayName}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    data-testid="button-create-account"
                  >
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        Join CineDeep
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-emerald-500" size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">You're In!</h2>
                <p className="text-zinc-400 text-sm">Welcome to CineDeep</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
