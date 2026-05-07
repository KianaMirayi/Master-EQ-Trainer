import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, LogIn, ChevronRight, AlertCircle, Loader2, CheckCircle2, User } from 'lucide-react';
import { FirebaseService } from '../lib/FirebaseService';
import { cn } from '../lib/utils';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'selection' | 'email' | 'signup' | 'forgotPassword'>('selection');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const user = await FirebaseService.login();
      if (user) onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === 'signup') {
        if (!displayName.trim()) {
          throw new Error('Please enter a display name');
        }
        await FirebaseService.registerWithEmail(email, password);
        await FirebaseService.updateDisplayName(displayName);
        setSuccess('Account created successfully!');
      } else {
        await FirebaseService.loginWithEmail(email, password);
      }
      setTimeout(() => onClose(), mode === 'signup' ? 1500 : 0);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email or password incorrect');
      } else {
        setError(err.message || 'Action failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await FirebaseService.resetPassword(email);
      setSuccess('Password reset email sent! Please check your inbox.');
      setTimeout(() => setMode('email'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {mode === 'forgotPassword' ? 'Reset Password' : (mode === 'signup' ? 'Create Account' : 'Welcome Back')}
                </h2>
                <p className="text-slate-400 text-sm">
                  {mode === 'forgotPassword' 
                    ? 'Enter your email to receive a reset link' 
                    : (mode === 'signup' ? 'Join the community and track your IQ' : 'Sync your progress and climb the leaderboard')}
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3 text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {mode === 'selection' ? (
                <div className="space-y-4">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </button>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-900 px-2 text-slate-500 font-bold tracking-widest">OR</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setMode('email')}
                    className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95"
                  >
                    <Mail className="w-5 h-5" />
                    Continue with Email
                  </button>
                </div>
              ) : mode === 'email' || mode === 'signup' ? (
                <form onSubmit={handleEmailAction} className="space-y-4">
                  {mode === 'signup' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Display Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your username"
                          className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 text-white focus:border-cyan-500 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 text-white focus:border-cyan-500 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Password</label>
                      {mode === 'email' && (
                        <button 
                          type="button"
                          onClick={() => setMode('forgotPassword')}
                          className="text-xs font-bold text-cyan-500 hover:text-cyan-400 transition-colors"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <strong className="absolute left-3.5 top-1/2 -translate-y-1/2"><Lock className="w-5 h-5 text-slate-600" /></strong>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 text-white focus:border-cyan-500 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 mt-6"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                    {mode === 'signup' ? 'Create Account' : 'Sign In'}
                  </button>

                  <div className="flex flex-col items-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setMode(mode === 'signup' ? 'email' : 'signup')}
                      className="text-sm text-cyan-500 hover:text-cyan-400 transition-colors font-bold"
                    >
                      {mode === 'signup' ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('selection')}
                      className="text-sm text-slate-500 hover:text-slate-300 py-1 transition-colors font-medium"
                    >
                      Back to options
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 text-white focus:border-cyan-500 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 mt-6"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                    Send Reset Link
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('email')}
                    className="w-full text-center text-sm text-slate-500 hover:text-cyan-400 py-2 transition-colors font-medium"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
