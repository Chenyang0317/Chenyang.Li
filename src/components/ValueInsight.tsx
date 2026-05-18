import React, { useState } from 'react';
import { Sparkles, Loader2, ArrowRight, Zap, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { analyzeBloggerValue, BloggerValueResult } from '../lib/gemini';
import { UnifiedUserProfile, UnifiedVideo } from '../lib/platforms';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface ValueInsightProps {
  profile: UnifiedUserProfile;
  videos: UnifiedVideo[];
  onReport: (result: BloggerValueResult) => void;
  hasReport: boolean;
}

export function ValueInsight({ profile, videos, onReport, hasReport }: ValueInsightProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeBloggerValue(profile, videos);
      onReport(res);
    } catch (err: any) {
      setError(err.message || '分析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (hasReport) {
    return (
      <div className="w-full md:w-80 shrink-0 bg-gradient-to-br from-green-50 to-emerald-50/50 rounded-2xl border border-green-200/50 p-6 flex flex-col items-center justify-center text-center h-full min-h-[220px]">
         <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-green-200/50">
            <Sparkles size={20} />
         </div>
         <h3 className="font-bold text-green-800 text-sm mb-2">报告已生成</h3>
         <p className="text-xs text-green-600/80 mb-4 px-2">商业价值洞察报告已成功生成，请在下方长图文区域查看详细内容。</p>
         <button 
           onClick={() => document.getElementById('insight-report-section')?.scrollIntoView({ behavior: 'smooth' })}
           className="px-4 py-2 bg-white text-green-700 shadow-sm rounded-full text-xs font-bold border border-green-100 hover:bg-green-50 transition-colors flex items-center gap-1.5"
         >
           向下翻阅详请 <ArrowRight size={14} />
         </button>
      </div>
    );
  }

  return (
    <div className="w-full md:w-80 shrink-0 relative group rounded-2xl overflow-hidden h-full min-h-[220px] isolate">
       {/* Premium background effect */}
       <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 z-[-1]"></div>
       
       {/* Ambient mesh gradients */}
       <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/30 rounded-full blur-3xl mix-blend-screen group-hover:scale-150 transition-transform duration-700"></div>
       <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl mix-blend-screen group-hover:scale-150 transition-transform duration-700 delay-100"></div>
       
       <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
       
       {/* Glass container */}
       <div className="absolute inset-0.5 bg-slate-900/40 backdrop-blur-md rounded-[15px] border border-white/10 flex flex-col items-center justify-center text-center p-6 z-10 transition-colors duration-500 group-hover:bg-slate-900/20">
           <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/50">
             <Sparkles size={24} className="text-white" />
           </div>
           
           <h3 className="font-bold text-white text-base mb-2 tracking-wide flex items-center gap-1">
             <Zap size={16} className="text-yellow-400" /> AI 商业价值审计
           </h3>
           
           <p className="text-xs text-slate-300 font-medium mb-6 px-1 leading-relaxed">
             通过大语言模型深度解析当前博主的变现潜力、粉丝含金量与商业匹配度。
           </p>

           <button 
             onClick={handleAnalyze}
             disabled={loading || !videos || videos.length === 0}
             className={cn(
               "relative w-full overflow-hidden text-sm font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border",
               loading 
                 ? "bg-white/10 text-white border-white/20" 
                 : videos && videos.length > 0 
                    ? "bg-white text-indigo-900 border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:bg-slate-50"
                    : "bg-white/5 text-slate-400 border-white/10"
             )}
           >
             {loading && <Loader2 size={16} className="animate-spin text-white" />}
             {!loading && <TrendingUp size={16} />}
             <span className="relative z-10">
               {loading ? '正在执行审计引擎...' : (videos && videos.length > 0 ? '一键生成深度报告' : '请先获取视频数据')}
             </span>
             {loading && (
               <motion.div 
                 className="absolute inset-0 bg-white/10" 
                 animate={{ x: ["-100%", "100%"] }} 
                 transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
               />
             )}
           </button>
           
           {error && (
             <motion.p 
               initial={{ opacity: 0, y: 5 }} 
               animate={{ opacity: 1, y: 0 }} 
               className="text-red-400 text-xs mt-3 bg-red-950/50 px-3 py-1.5 rounded-lg border border-red-900/50 inline-block"
             >
               {error}
             </motion.p>
           )}
       </div>
    </div>
  );
}
