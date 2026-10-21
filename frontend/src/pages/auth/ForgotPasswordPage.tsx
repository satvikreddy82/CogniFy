import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowLeft, Mail, KeyRound, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { ThemeSelector } from '../../components/ThemeSelector';

type Step = 'email' | 'otp' | 'newpw' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  // Session tokens from the verify-otp step (OTP is single-use; store tokens for reset step)
  const [sessionTokens, setSessionTokens] = useState<{ access_token: string; refresh_token: string } | null>(null);

  const startCooldown = () => {
    let secs = 60;
    setResendCooldown(secs);
    const t = setInterval(() => {
      secs--;
      setResendCooldown(secs);
      if (secs <= 0) clearInterval(t);
    }, 1000);
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await api.post('/auth/request-otp', { email: email.trim().toLowerCase() });
      setStep('otp');
      startCooldown();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send recovery code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      // Store session tokens for the reset step (OTP is single-use)
      if (res.data?.access_token && res.data?.refresh_token) {
        setSessionTokens({ access_token: res.data.access_token, refresh_token: res.data.refresh_token });
      }
      setStep('newpw');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          'Invalid or expired 6-digit verification code. Please check your email or request a new code.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPw) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password,
        confirm_password: confirmPw,
        // Forward session tokens so the backend doesn't need to re-verify the single-use OTP
        ...(sessionTokens ?? {}),
      });
      setStep('done');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          'Password reset failed. The code may have expired. Please request a new verification code.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const errorBox = error && (
    <div className="mb-4 flex gap-2 items-start p-3 rounded-brand text-xs font-medium" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface-2">
      {/* Top Header with Theme Selector */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-default bg-surface shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-brand flex items-center justify-center shadow-sm"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <BookOpen className="w-4 h-4" style={{ color: 'var(--text-on-primary)' }} />
          </div>
          <span className="font-bold text-default">CogniFy</span>
          <span className="text-xs text-muted hidden sm:inline-block border-l border-default pl-2 ml-1">
            Account Recovery
          </span>
        </div>

        {/* Top-Right Theme Selector */}
        <ThemeSelector />
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="card p-8 shadow-card-lg border border-default animate-fade-in bg-surface">
            <div className="flex items-center gap-2 mb-4">
              <Link to="/login" className="p-1 rounded-brand text-muted hover:text-default hover:bg-surface-2 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h2 className="text-xl font-bold text-default">Reset Password</h2>
            </div>

            {/* Step 1 — Email */}
            {step === 'email' && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <p className="text-xs text-muted">Enter your registered email and we'll send you a verification code.</p>
                {errorBox}
                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input type="email" className="input w-full pl-10" placeholder="you@cognify.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold shadow-md">
                  {isLoading ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Sending…</> : 'Send OTP'}
                </button>
              </form>
            )}

            {/* Step 2 — OTP */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-xs text-muted">Enter the 6-digit OTP sent to <strong>{email}</strong>. It expires in 15 minutes.</p>
                {errorBox}
                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">One-Time Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="input w-full pl-10 text-center tracking-widest text-lg font-mono"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold shadow-md">
                  {isLoading ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Verifying…</> : 'Verify OTP'}
                </button>
                <div className="text-center text-xs text-muted">
                  {resendCooldown > 0
                    ? `Resend OTP in ${resendCooldown}s`
                    : <button type="button" onClick={() => handleRequestOtp()} disabled={isLoading} className="font-semibold text-primary underline hover:opacity-80 transition-opacity">Resend OTP</button>
                  }
                </div>
              </form>
            )}

            {/* Step 3 — New Password */}
            {step === 'newpw' && (
              <form onSubmit={handleResetPw} className="space-y-4">
                <p className="text-xs text-muted">Choose a new password for your account.</p>
                {errorBox}
                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">New Password</label>
                  <input type="password" className="input w-full" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">Confirm Password</label>
                  <input type="password" className="input w-full" placeholder="Repeat password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
                </div>
                <button type="submit" disabled={isLoading} className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold shadow-md">
                  {isLoading ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Resetting…</> : 'Reset Password'}
                </button>
              </form>
            )}

            {/* Done */}
            {step === 'done' && (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 mx-auto" style={{ color: 'var(--success)' }} />
                <h3 className="text-lg font-semibold text-default">Password Reset Successful!</h3>
                <p className="text-xs text-muted">Your password has been updated. You can now sign in with your new credentials.</p>
                <Link to="/login" className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold">Back to Login</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
