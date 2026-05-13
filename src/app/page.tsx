'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Lock, User, ArrowRight, RefreshCw, Key } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaImg, setCaptchaImg] = useState('');
  const [captchaHint, setCaptchaHint] = useState('');
  const [tempSessionId, setTempSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCaptcha, setIsFetchingCaptcha] = useState(false);
  const router = useRouter();

  const fetchCaptcha = async () => {
    setIsFetchingCaptcha(true);
    try {
      const res = await fetch('/api/auth/initiate');
      const data = await res.json();
      if (data.captchaImage) {
        setCaptchaImg(data.captchaImage);
      }
      if (data.hint) {
        setCaptchaHint(data.hint);
      }
      setTempSessionId(data.tempSessionId);
    } catch (err) {
      console.error('Failed to fetch captcha');
    } finally {
      setIsFetchingCaptcha(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, captcha, tempSessionId }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const error = await res.json();
        alert(error.error || 'Login failed. Please check your credentials and captcha.');
        fetchCaptcha();
        setCaptcha('');
      }
    } catch (err) {
      alert('An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-md w-full space-y-16"
      >
        {/* Grayscale Branding */}
        <div className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)]">
            <GraduationCap className="w-12 h-12 text-black" />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black tracking-tighter text-white uppercase">UUCMS SYNC</h2>
            <p className="text-zinc-600 text-xs font-black uppercase tracking-[0.4em]">Academic Intelligence</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div className="space-y-4">
            <div className="relative group">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-white transition-colors" />
              <input 
                type="text" 
                placeholder="REGISTER NUMBER" 
                className="w-full bg-white/5 border border-white/10 rounded-3xl py-5 pl-14 pr-6 outline-none focus:bg-white/10 transition-all text-white placeholder:text-zinc-800 font-bold text-xs tracking-widest"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-white transition-colors" />
              <input 
                type="password" 
                placeholder="PASSWORD" 
                className="w-full bg-white/5 border border-white/10 rounded-3xl py-5 pl-14 pr-6 outline-none focus:bg-white/10 transition-all text-white placeholder:text-zinc-800 font-bold text-xs tracking-widest"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Monochrome Captcha */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-16 bg-white/5 rounded-3xl overflow-hidden flex items-center justify-center relative border border-white/10">
                  {isFetchingCaptcha ? (
                    <div className="animate-pulse bg-white/10 w-full h-full" />
                  ) : captchaImg ? (
                    <img src={captchaImg} alt="Captcha" className="h-full w-full object-contain invert opacity-50 grayscale" />
                  ) : captchaHint ? (
                    <span className="text-2xl font-black tracking-[0.3em] text-zinc-400 uppercase">{captchaHint}</span>
                  ) : (
                    <span className="text-xs text-zinc-700 font-bold uppercase">Load Error</span>
                  )}
                </div>
                <button 
                  type="button" 
                  onClick={fetchCaptcha}
                  disabled={isFetchingCaptcha}
                  className="h-16 w-16 flex items-center justify-center bg-white/5 rounded-3xl transition-all active:scale-90 border border-white/10"
                >
                  <RefreshCw className={`w-5 h-5 text-zinc-500 ${isFetchingCaptcha ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="relative group">
                <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-white transition-colors" />
                <input 
                  type="text" 
                  placeholder="ENTER CAPTCHA" 
                  className="w-full bg-white/5 border border-white/10 rounded-3xl py-5 pl-14 pr-6 outline-none focus:bg-white/10 transition-all text-white placeholder:text-zinc-800 font-black tracking-[0.5em] text-center text-sm"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <motion.button 
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={isLoading || isFetchingCaptcha}
            className="w-full bg-white text-black font-black py-5 rounded-3xl shadow-2xl transition-all disabled:opacity-30 uppercase tracking-[0.2em] text-sm"
          >
            {isLoading ? 'SYNCING...' : 'AUTHORIZE'}
          </motion.button>
        </form>

        <div className="text-center space-y-4">
           <p className="text-[10px] text-zinc-800 font-black uppercase tracking-[0.2em] max-w-[250px] mx-auto leading-relaxed">
             Direct sync with official portal. Zero persistence. Pure monochrome.
           </p>
        </div>
      </motion.div>
    </div>
  );
}
