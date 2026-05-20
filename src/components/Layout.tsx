import React, { useState } from 'react';
import { Search, Settings, Box, User, Hash, ChevronDown, Activity, LogIn, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { storage } from '../lib/storage';
import { runMonitorAndSendFeishu } from './GlobalMonitorJob';
import { useAuth } from './AuthProvider';
import { AuthModal } from './AuthModal';

interface HeaderProps {
  onSettingsClick: () => void;
  onUsageClick?: () => void;
  activeTab: 'home' | 'profile_search' | 'management' | 'topics' | 'simulate';
  setActiveTab: (tab: 'home' | 'profile_search' | 'management' | 'topics' | 'simulate') => void;
}

export function Header({ onSettingsClick, onUsageClick, activeTab, setActiveTab }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const tabs = [
    { id: 'home', label: '首页' },
    { id: 'profile_search', label: '视频搜索' },
    { id: 'management', label: '博主信息' },
    { id: 'topics', label: '话题信息' },
    { id: 'simulate', label: '模拟投流' },
  ] as const;

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-5 bg-white/80 backdrop-blur-xl border-b border-white/20">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-200">
            <Box size={22} strokeWidth={2.5} />
          </div>
          <span className="font-bold text-2xl tracking-tighter text-slate-800">VideoTrend</span>
        </div>

        <nav className="hidden md:flex items-center gap-4 bg-slate-50/80 p-1.5 rounded-full border border-slate-100/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 relative",
                activeTab === tab.id 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button 
            onClick={onUsageClick}
            className="flex items-center justify-center w-10 h-10 text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors bg-white/50 rounded-full shadow-sm border border-green-100"
            title="查看用量概览"
          >
            <Activity size={18} />
          </button>
          <button 
            onClick={onSettingsClick}
            className="flex items-center justify-center w-10 h-10 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors bg-white/50 rounded-full shadow-sm border border-slate-100"
            title="系统接口设置"
          >
            <Settings size={18} />
          </button>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          {user ? (
            <div className="relative group cursor-pointer">
              <img src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email || 'U'}&background=random&color=fff`} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-slate-100 group-hover:border-blue-300 transition-colors" />
              <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none group-hover:pointer-events-auto z-50">
                 <div className="px-4 py-2 border-b border-slate-50 mb-1">
                    <p className="text-sm font-bold text-slate-700 truncate" title={user.user_metadata?.name || user.email || ''}>{user.user_metadata?.name || user.email}</p>
                 </div>
                 <button onClick={signOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                    <LogOut size={16} /> 退 出 登 录
                 </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center justify-center w-10 h-10 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors bg-white/50 rounded-full shadow-sm border border-blue-100"
              title="登录 / 注册"
            >
              <User size={18} />
            </button>
          )}
        </div>
      </header>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const [tikhubKey, setTikhubKey] = useState('');
  const [atypicaKey, setAtypicaKey] = useState('');
  const [bochaKey, setBochaKey] = useState('');
  const [feishuWebhook, setFeishuWebhook] = useState('');
  const [saved, setSaved] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      storage.get<string>('tikhub_api_key').then(key => {
        if (key) setTikhubKey(key);
      });
      storage.get<string>('atypica_api_key').then(key => {
        if (key) setAtypicaKey(key);
      });
      storage.get<string>('bocha_api_key').then(key => {
        if (key) setBochaKey(key);
      });
      storage.get<string>('feishu_webhook_url').then(url => {
        if (url) setFeishuWebhook(url);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await storage.set('tikhub_api_key', tikhubKey);
    await storage.set('atypica_api_key', atypicaKey);
    await storage.set('bocha_api_key', bochaKey);
    await storage.set('feishu_webhook_url', feishuWebhook);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl border border-slate-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">系统接口配置</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">配置您的外部服务 API 密钥以启用高级功能。</p>
        </div>
        
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">TikHub API Key (视频抓取)</label>
              <input
                type="password"
                value={tikhubKey}
                onChange={(e) => setTikhubKey(e.target.value)}
                placeholder="请输入 TikHub API Key"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Atypica API Key</label>
              <input
                type="password"
                value={atypicaKey}
                onChange={(e) => setAtypicaKey(e.target.value)}
                placeholder="请输入 Atypica API Key"
                className="w-full px-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Bocha Web Search API Key (视频互联网分析)</label>
              <input
                type="password"
                value={bochaKey}
                onChange={(e) => setBochaKey(e.target.value)}
                placeholder="请输入 Bocha API Key"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800 font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">飞书机器人 Webhook URL</label>
              <input
                type="text"
                value={feishuWebhook}
                onChange={(e) => setFeishuWebhook(e.target.value)}
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-mono text-sm"
              />
            </div>
          </div>

        <div className="flex justify-between items-center mt-2">
          <button 
            onClick={async () => {
                if (!feishuWebhook) return alert("请先填写Webhook URL");
                await storage.set('feishu_webhook_url', feishuWebhook);
                const originalSaved = saved;
                setSaved(true); // just visual feedback
                await runMonitorAndSendFeishu();
                setTimeout(() => setSaved(originalSaved), 1000);
              }}
              className="px-4 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1.5"
              title="手动运行全部博主的每日监控并推送飞书"
            >
              <Activity size={14} />
              <span>模拟定时任务发送测试</span>
            </button>

          <div className="flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            >
              取消
            </button>
            <button 
              onClick={handleSave}
              className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
            >
              {saved ? '配置已保存！' : '保存配置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
