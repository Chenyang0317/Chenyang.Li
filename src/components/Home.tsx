import React, { useState } from 'react';
import { Search, User, Hash, ChevronDown, Sparkles, Zap, ArrowRight, Play, LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';
import { InteractiveDots } from './InteractiveDots';
import { motion, AnimatePresence } from 'motion/react';

interface HomeProps {
  onSearch: (query: string, mode: 'user' | 'topic', platform: string) => void;
}

export function HomeView({ onSearch }: HomeProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'user' | 'topic'>('user');
  const [platform, setPlatform] = useState('抖音');
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const platforms = ['抖音', 'B站', '小红书', '微博'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), mode, platform);
    }
  };

  const getPlaceholder = () => {
    if (mode === 'topic') {
      if (platform === '抖音') return "输入抖音话题链接或 ID...";
      if (platform === 'B站') return "输入 B 站话题搜索关键词...";
      if (platform === '微博') return "输入微博话题搜索关键词...";
      if (platform === '小红书') return "输入小红书话题搜索关键词...";
      return "输入话题搜索关键词...";
    }
    if (platform === '微博') return "输入微博主页链接或 UID...";
    if (platform === 'B站') return "输入 B 站主页链接或 UID...";
    if (platform === '小红书') return "输入小红书分享链接或 ID...";
    return "输入博主主页链接或抖音号...";
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 relative overflow-hidden bg-[#F8FAFC]">
      <InteractiveDots />
      
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[80px] pointer-events-none delay-1000" />
      
      <div className="w-full max-w-4xl flex flex-col items-center mt-[-5vh] z-10">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-center gap-3 text-blue-600 font-bold tracking-[0.2em] text-[11px] mb-8 uppercase bg-blue-50/80 px-4 py-2 rounded-full border border-blue-100 shadow-sm"
        >
          <Zap size={14} className="fill-blue-600" />
          <span>Professional Data Insight</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="text-5xl md:text-7xl font-black leading-tight mb-6 tracking-tight text-center flex flex-col sm:flex-row items-center gap-2 sm:gap-4"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600">全平台内容</span> 
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-cyan-500 relative">
            洞察分析
            <motion.div 
               initial={{ width: 0 }} 
               animate={{ width: "100%" }} 
               transition={{ duration: 0.8, delay: 0.5, ease: "circOut" }} 
               className="absolute -bottom-2 left-0 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" 
            />
          </span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="text-slate-500 text-base md:text-lg font-medium mb-12 max-w-2xl text-center leading-relaxed"
        >
          输入链接或 ID，通过 AI 深度建模技术瞬间发现爆款视频背后的核心逻辑，一键提取热门评论与画像数据。
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          className="w-full bg-white/70 backdrop-blur-2xl p-4 sm:p-6 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white/80 relative"
        >
          {/* Glass glare effect */}
          <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
          
          <form onSubmit={handleSubmit} className="relative z-10 w-full flex flex-col gap-6">
            
            {/* Control Bar (Mode + Platform) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
               
               <div className="flex bg-slate-100/80 p-1.5 rounded-full relative shadow-inner">
                  {['user', 'topic'].map((m) => {
                     const isSelected = mode === m;
                     return (
                        <button
                           key={m}
                           type="button"
                           onClick={() => setMode(m as any)}
                           className={cn(
                              "relative px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-colors z-10",
                              isSelected ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                           )}
                        >
                           {isSelected && (
                              <motion.div 
                                 layoutId="mode-indicator" 
                                 className="absolute inset-0 bg-white rounded-full shadow-sm border border-slate-200/50 -z-10"
                                 transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              />
                           )}
                           {m === 'topic' ? <Hash size={16} /> : <User size={16} />}
                           {m === 'topic' ? "话题模式" : "博主模式"}
                        </button>
                     );
                  })}
               </div>

               <div className="relative z-20">
                  <button
                     type="button"
                     onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                     className="flex items-center gap-3 bg-white px-6 py-2.5 rounded-full shadow-sm border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all hover:border-blue-200 group"
                  >
                     <Sparkles size={16} className="text-blue-500 group-hover:rotate-12 transition-transform" />
                     {platform}
                     <ChevronDown size={14} className={cn("transition-transform duration-300 text-slate-400", platformDropdownOpen && "rotate-180")} />
                  </button>
                  
                  <AnimatePresence>
                     {platformDropdownOpen && (
                        <motion.div 
                           initial={{ opacity: 0, y: 10, scale: 0.95 }}
                           animate={{ opacity: 1, y: 0, scale: 1 }}
                           exit={{ opacity: 0, y: 10, scale: 0.95 }}
                           transition={{ duration: 0.2 }}
                           className="absolute top-full mt-2 right-0 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 grid grid-cols-1 gap-1"
                        >
                           {platforms.map(p => (
                           <button
                              key={p}
                              type="button"
                              onClick={() => { setPlatform(p); setPlatformDropdownOpen(false); }}
                              className={cn(
                                 "px-4 py-2.5 text-sm transition-all rounded-xl flex items-center justify-between font-bold",
                                 platform === p ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              )}
                           >
                              {p}
                              {platform === p && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                           </button>
                           ))}
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>
            </div>

            {/* Main Search Input */}
            <div className={cn(
               "relative flex items-center bg-white rounded-full p-2 shadow-sm border-2 transition-all duration-300",
               isFocused ? "border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.1)] pt-2 pb-2 pl-2" : "border-slate-100 hover:border-slate-200"
            )}>
               <div className={cn("pl-6 transition-colors duration-300", isFocused ? "text-blue-500" : "text-slate-400")}>
                  <Search size={24} />
               </div>
               <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={getPlaceholder()}
                  className="flex-1 px-5 py-4 bg-transparent border-none focus:outline-none text-slate-800 text-lg font-medium placeholder:text-slate-300"
               />
               <button 
                  type="submit"
                  className={cn(
                     "flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-300 overflow-hidden",
                     query.trim() 
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 px-8 py-4" 
                        : "bg-slate-100 text-slate-400 px-6 py-4"
                  )}
               >
                  <span>立即分析</span>
                  <ArrowRight size={18} className={cn("transition-transform", query.trim() ? "translate-x-0" : "-translate-x-1 opacity-50")} />
               </button>
            </div>
          </form>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-12 flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-sm font-medium text-slate-400"
        >
           <span className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-full shadow-sm border border-slate-100"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> 毫秒级响应</span>
           <span className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-full shadow-sm border border-slate-100"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" /> AI 深度洞察</span>
           <span className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-full shadow-sm border border-slate-100"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" /> 全网覆盖</span>
        </motion.div>

      </div>
    </div>
  );
}
