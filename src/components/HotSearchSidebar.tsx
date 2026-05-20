import React, { useState, useEffect } from 'react';
import { fetchHotSearchList } from '../lib/tikhub';
import { Flame, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface HotSearchSidebarProps {
  onTopicClick: (topicName: string, platform: '抖音' | '微博') => void;
}

export function HotSearchSidebar({ onTopicClick }: HotSearchSidebarProps) {
  const [activePlatform, setActivePlatform] = useState<'抖音' | '微博'>('抖音');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData(activePlatform, false);
  }, [activePlatform]);

  const loadData = async (platform: '抖音' | '微博', forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = localStorage.getItem(`hot_search_${platform}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // If parsed data looks like genuine hot search data, use it; otherwise fetch fresh data
          if (parsed && Array.isArray(parsed)) {
            const validItems = parsed.filter(i => getTopicName(i, platform));
            if (validItems.length > 5) {
              setItems(parsed);
              return;
            }
          }
        } catch(e) {}
      }
    }

    setLoading(true);
    setError('');
    
    // Clear display only if force refreshing to indicate loading
    if (forceRefresh) setItems([]);

    try {
      const data = await fetchHotSearchList(platform);
      setItems(data || []);
      localStorage.setItem(`hot_search_${platform}`, JSON.stringify(data || []));
    } catch (err: any) {
      console.error(`[HotSearchSidebar] Error fetching ${platform}:`, err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getTopicName = (item: any, platform: '抖音' | '微博') => {
    if (typeof item === 'string') return item;
    if (platform === '抖音') {
      return item.word || '';
    } else {
      return item.word_scheme || item.word || item.desc || item.title || item.item_name || item.note || '';
    }
  };

  const getHeatCount = (item: any, platform: '抖音' | '微博') => {
    if (platform === '抖音') {
      return item.hot_value ? (item.hot_value / 10000).toFixed(1) + 'w' : '';
    } else {
      let num = item.num || item.desc_extr;
      if (num && typeof num === 'number') {
        return (num / 10000).toFixed(1) + 'w';
      }
      return num ? num.toString() : '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/60 backdrop-blur-md">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-black flex items-center gap-2 text-slate-800">
          <Flame size={16} className="text-red-500" /> 全网热搜预警
        </h2>
        <button 
          onClick={() => loadData(activePlatform, true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} /> 追踪
        </button>
      </div>
      
      <div className="flex p-2 gap-1 bg-slate-50/50">
        {(['抖音', '微博'] as const).map(p => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={cn(
               "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
               activePlatform === p ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {p}榜
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-sm">实时数据获取中...</span>
          </div>
        ) : error ? (
          <div className="text-xs text-red-500 text-center py-8">{error}</div>
        ) : items.filter((item) => getTopicName(item, activePlatform)).length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-8">
             此项类别中未能检测到热搜列表数据
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.filter(item => getTopicName(item, activePlatform)).slice(0, 7).map((item, index) => {
              const name = getTopicName(item, activePlatform);
               if (!name) return null;
               
               const isTop = index < 3;
               return (
                 <motion.button
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: index * 0.02 }}
                   key={index}
                   onClick={() => onTopicClick(name, activePlatform)}
                   className="flex items-start gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all group text-left border border-transparent hover:border-slate-100"
                 >
                   <span className={cn(
                     "text-sm font-black italic mt-0.5",
                     index === 0 ? "text-red-500" : index === 1 ? "text-orange-500" : index === 2 ? "text-amber-500" : "text-slate-300"
                   )}>
                     {index + 1}
                   </span>
                   <div className="flex-1 overflow-hidden">
                     <p className="text-sm font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                       {name}
                     </p>
                     {getHeatCount(item, activePlatform) && (
                       <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                         <TrendingUp size={10} /> {getHeatCount(item, activePlatform)}
                       </p>
                     )}
                   </div>
                 </motion.button>
               )
            })}
          </div>
        )}
      </div>
    </div>
  );
}
