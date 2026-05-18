import React, { useState, useMemo } from 'react';
import { UnifiedVideo } from '../lib/platforms';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { formatNumber } from '../lib/utils';
import { format } from 'date-fns';
import { TrendingUp, Activity, Heart, Calendar } from 'lucide-react';

interface DataAnalysisProps {
  videos: UnifiedVideo[];
}

export function DataAnalysis({ videos }: DataAnalysisProps) {
  if (!videos || videos.length === 0) return null;

  const { stats, primaryMetric } = useMemo(() => {
    const totalLikes = videos.reduce((acc, v) => acc + v.stats.likeCount, 0);
    const totalComments = videos.reduce((acc, v) => acc + v.stats.commentCount, 0);
    const totalShares = videos.reduce((acc, v) => acc + (v.stats.shareCount || 0), 0);
    const totalCollects = videos.reduce((acc, v) => acc + (v.stats.collectCount || 0), 0);
    const totalPlays = videos.reduce((acc, v) => acc + (v.stats.playCount || 0), 0);
    
    const avgLikes = videos.length > 0 ? Math.round(totalLikes / videos.length) : 0;
    const avgPlays = videos.length > 0 ? Math.round(totalPlays / videos.length) : 0;
    const avgEngagement = videos.length > 0 ? Math.round((totalLikes + totalComments + totalShares + totalCollects + totalPlays) / videos.length) : 0;
    
    const isPlayPrimary = totalLikes === 0 && totalPlays > 0;
    const primaryMetric = {
      name: isPlayPrimary ? '播放' : '点赞',
      total: isPlayPrimary ? totalPlays : totalLikes,
      avg: isPlayPrimary ? avgPlays : avgLikes,
      icon: isPlayPrimary ? <Activity size={16} /> : <Heart size={16} />
    };
    
    // Sort videos by date early to late for the chart / dates
    const sortedByDate = [...videos].sort((a, b) => a.createTime - b.createTime);
    
    let freq = 0;
    if (sortedByDate.length > 1) {
      const firstDate = sortedByDate[0].createTime < 10000000000 ? sortedByDate[0].createTime * 1000 : sortedByDate[0].createTime;
      const lastDate = sortedByDate[sortedByDate.length - 1].createTime < 10000000000 ? sortedByDate[sortedByDate.length - 1].createTime * 1000 : sortedByDate[sortedByDate.length - 1].createTime;
      const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24) || 1;
      const weeksCount = daysDiff / 7;
      freq = weeksCount > 0 ? sortedByDate.length / weeksCount : sortedByDate.length;
    }

    const chartData = sortedByDate.map(v => {
      const timestampMs = v.createTime < 10000000000 ? v.createTime * 1000 : v.createTime;
      return {
        date: format(new Date(timestampMs), 'M月d日'),
        fullDate: format(new Date(timestampMs), 'yyyy-MM-dd HH:mm:ss'),
        播放: v.stats.playCount || 0,
        点赞: v.stats.likeCount,
        评论: v.stats.commentCount,
        转发: v.stats.shareCount || 0,
        收藏: v.stats.collectCount || 0,
        全维互动: v.stats.likeCount + v.stats.commentCount + (v.stats.shareCount || 0) + (v.stats.collectCount || 0) + (v.stats.playCount || 0),
        title: v.title || '未知视频'
      };
    });

    return { 
      stats: { totalLikes, avgLikes, avgEngagement, freq: freq.toFixed(1), chartData }, 
      primaryMetric 
    };
  }, [videos]);

  const [activeMetrics, setActiveMetrics] = useState<string[]>(['播放', '点赞']);

  const toggleMetric = (m: string) => {
    setActiveMetrics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const colors: Record<string, string> = {
    播放: '#14B8A6',
    点赞: '#3B82F6',
    全维互动: '#F43F5E',
    收藏: '#F59E0B',
    转发: '#10B981',
    评论: '#8B5CF6'
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 mt-2 mb-8">
      <div className="mb-4 flex items-center gap-2 text-slate-800 font-bold text-xl">
        <Activity className="text-blue-600" />
        <h2>核心指标与数据趋势</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-rose-500 font-medium mb-3 text-sm">
            <TrendingUp size={16} /> <span>平均{primaryMetric.name}</span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">{formatNumber(primaryMetric.avg)}</div>
          <div className="text-[10px] lg:text-xs text-slate-400 font-semibold mt-auto pt-2">当前抓取样本 ({videos.length} 条)</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-blue-500 font-medium mb-3 text-sm">
            <Activity size={16} /> <span>平均互动</span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">{formatNumber(stats.avgEngagement)}</div>
          <div className="text-[10px] lg:text-xs text-slate-400 font-semibold mt-auto pt-2">播+赞+评+收+转平均值</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-indigo-500 font-medium mb-3 text-sm">
            {primaryMetric.icon} <span>样本{primaryMetric.name === '点赞' ? '获赞' : '总播放'}</span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">{formatNumber(primaryMetric.total)}</div>
          <div className="text-[10px] lg:text-xs text-slate-400 font-semibold mt-auto pt-2">当前样本累计{primaryMetric.name}表现</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 text-emerald-500 font-medium mb-3 text-sm">
            <Calendar size={16} /> <span>更新频率</span>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">{stats.freq}</div>
          <div className="text-[10px] lg:text-xs text-slate-400 font-semibold mt-auto pt-2">近一段时间平均每周发布(篇)</div>
        </div>
      </div>

      <div className="bg-white p-5 md:p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div> 数据全景趋势分析
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm font-medium">
            {Object.keys(colors).map(metric => (
              <label key={metric} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={activeMetrics.includes(metric)}
                  onChange={() => toggleMetric(metric)}
                  className="rounded text-blue-600 focus:ring-blue-500 transition-all border-slate-300 w-3.5 h-3.5 cursor-pointer"
                />
                <span className={activeMetrics.includes(metric) ? 'text-slate-800' : 'text-slate-400'}>{metric}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="h-[300px] md:h-[400px] w-full mt-4 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={300}>
            <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {Object.entries(colors).map(([key, color]) => (
                  <linearGradient key={key} id={`color_${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                dy={10}
                minTickGap={30}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                dx={-10}
                width={50}
                tickFormatter={(value) => value >= 10000 ? `${(value / 10000).toFixed(1)}w` : value}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', padding: '12px 16px', fontWeight: 'bold' }}
                itemStyle={{ fontWeight: 600, fontSize: '13px' }}
                labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}
                formatter={(value: number, name: string) => [value.toLocaleString(), name]}
              />
              {activeMetrics.map(metric => (
                <Area 
                  key={metric}
                  type="monotone" 
                  dataKey={metric} 
                  stroke={colors[metric]} 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill={`url(#color_${metric})`} 
                  activeDot={{ r: 6, strokeWidth: 0, fill: colors[metric] }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
