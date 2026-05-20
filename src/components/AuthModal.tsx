import React, { useState } from 'react';
import { X, Github, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGithub, signInWithEmail, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      if (isLogin) {
        await signInWithEmail(email, password);
        onClose();
        setTimeout(() => window.location.reload(), 200);
      } else {
        await signUpWithEmail(email, password);
        setSuccessMsg('注册成功！请查看邮箱完成验证，或者直接登录。');
        setIsLogin(true); // Switch to login mode
      }
    } catch (err: any) {
      setError(err.message || (isLogin ? '登录失败，请检查邮箱和密码' : '注册失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col gap-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>
        
        <div className="text-center mt-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{isLogin ? '登录账号' : '注册账号'}</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">使用您的邮箱和密码进行{isLogin ? '登录' : '注册'}</p>
        </div>
        
        <div className="flex flex-col gap-4 mt-2">
          {successMsg && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm font-medium text-center">
              {successMsg}
            </div>
          )}
          <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="邮箱地址"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                required
              />
            </div>
            
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码 (最少 6 位)"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                required
                minLength={6}
              />
            </div>
            
            {error && <p className="text-red-500 text-xs font-medium text-center">{error}</p>}
            
            <button 
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
            >
              <span>{loading ? '处理中...' : (isLogin ? '登录' : '注册')}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
            
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setSuccessMsg(null);
              }}
              className="mt-2 text-sm text-slate-500 hover:text-slate-800 transition-colors text-center"
            >
              {isLogin ? '没有账号？立即注册' : '已有账号？立即登录'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-100"></div>
            <span className="text-xs font-bold text-slate-300">OR</span>
            <div className="flex-1 h-px bg-slate-100"></div>
          </div>

          <button 
            onClick={() => {
              signInWithGithub();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all"
          >
            <Github size={20} />
            <span>使用 GitHub 继续</span>
          </button>
        </div>
        
        <p className="text-xs text-center text-slate-400 mt-2">
          登录即代表您同意我们的服务条款
        </p>
      </div>
    </div>
  );
}
