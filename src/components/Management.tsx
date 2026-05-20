import React, { useEffect, useState } from 'react';
import { UnifiedUserProfile, fetchUserProfile, fetchUserVideos, fetchVideoComments, PlatformType } from '../lib/platforms';
import { storage } from '../lib/storage';
import { ChevronRight, Users, RotateCcw, Search, X, Loader2, BarChart2, Layers, CheckSquare, Plus, Check } from 'lucide-react';
import { formatNumber, cn, getProxiedAvatar } from '../lib/utils';
import { analyzeMonitorData, MonitorDataResult } from '../lib/gemini';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import { useAuth } from './AuthProvider';

interface ManagementViewProps {
  onBloggerClick: (platform: string, id: string, mode: 'view' | 'update', profile?: UnifiedUserProfile) => void;
  selectMode?: boolean;
  onMatrixSelect?: (matrixName: string, members: UnifiedUserProfile[]) => void;
}

export function ManagementView({ onBloggerClick, selectMode, onMatrixSelect }: ManagementViewProps) {
  const { user } = useAuth();
  const [bloggers, setBloggers] = useState<UnifiedUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('全部');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorData, setMonitorData] = useState<Record<string, MonitorDataResult>>({});
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  // Matrix grouping states
  const [viewMode, setViewMode] = useState<'account' | 'matrix'>(selectMode ? 'matrix' : 'account');
  const [mergeMode, setMergeMode] = useState(false);

  useEffect(() => {
    if (selectMode) {
      setViewMode('matrix');
      setMergeMode(false);
    }
  }, [selectMode]);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [newMatrixName, setNewMatrixName] = useState('');

  const platformsFilter = ['抖音', 'B站', '小红书', '微博'];

  useEffect(() => {
    loadBloggers();
    loadCachedMonitorData();
  }, [user]);

  const loadCachedMonitorData = async () => {
    const cachedMonitorData = await storage.get<Record<string, MonitorDataResult>>('monitorData');
    if (cachedMonitorData) setMonitorData(cachedMonitorData);
    
    const cachedFlippedCards = await storage.get<Record<string, boolean>>('flippedCards');
    if (cachedFlippedCards) setFlippedCards(cachedFlippedCards);
  };

  useEffect(() => {
    if (Object.keys(monitorData).length > 0) {
      storage.set('monitorData', monitorData);
    }
  }, [monitorData]);

  useEffect(() => {
    if (Object.keys(flippedCards).length > 0) {
      storage.set('flippedCards', flippedCards);
    }
  }, [flippedCards]);

  const handleAutoMonitor = async () => {
    if (isMonitoring || filteredBloggers.length === 0) return;
    setIsMonitoring(true);

    for (const blogger of filteredBloggers) {
      if (!blogger || !blogger.id) continue;
      
      const bloggerKey = `${blogger.platform}-${blogger.id}`;
      setUpdatingId(bloggerKey);

      try {
        const videoRes = await fetchUserVideos(blogger.platform as PlatformType, blogger.id, 0, 0, 'user', 0);
        const videos = videoRes.videos;
        
        if (videos.length < 2) {
          // Not enough videos to compare
          setMonitorData(prev => ({
            ...prev,
            [bloggerKey]: {
               metrics: [],
               commentSummary: '视频数量不足',
               analysis: '该博主近期视频不足两条，无法进行对比分析。'
            }
          }));
          setFlippedCards(prev => ({ ...prev, [bloggerKey]: true }));
          continue; 
        }

        const latestVideo = videos[0];
        const pastVideos = videos.slice(1, 10); // max 9 past videos for avg

        let totalLike = 0, totalComment = 0, totalShare = 0, totalCollect = 0;
        for (const v of pastVideos) {
          totalLike += v.stats.likeCount || 0;
          totalComment += v.stats.commentCount || 0;
          totalShare += v.stats.shareCount || 0;
          totalCollect += v.stats.collectCount || 0;
        }

        const avgMetrics = {
          like: totalLike / pastVideos.length,
          comment: totalComment / pastVideos.length,
          share: totalShare / pastVideos.length,
          collect: totalCollect / pastVideos.length
        };

        const commentRes = await fetchVideoComments(blogger.platform as PlatformType, latestVideo.id, 0, 20);
        
        const result = await analyzeMonitorData(latestVideo, avgMetrics, commentRes.comments);
        
        setMonitorData(prev => ({
          ...prev,
          [bloggerKey]: result
        }));
        
        setFlippedCards(prev => ({
          ...prev,
          [bloggerKey]: true
        }));
        
      } catch (err: any) {
        console.error(`Failed to monitor ${blogger.nickname}: `, err);
        setMonitorData(prev => ({
          ...prev,
          [bloggerKey]: {
             metrics: [],
             commentSummary: '监控异常',
             analysis: `获取数据失败: ${err.message || '未知错误'}。请稍后重试或检查平台接口状态。`
          }
        }));
        setFlippedCards(prev => ({ ...prev, [bloggerKey]: true }));
      }
    }

    setUpdatingId(null);
    setIsMonitoring(false);
  };

  const loadBloggers = async () => {
    setLoading(true);
    try {
      const list = await storage.get<UnifiedUserProfile[]>('saved_bloggers') || [];
      if (Array.isArray(list)) {
        setBloggers(list);
      } else {
        setBloggers([]);
      }
    } catch (e) {
      console.error("Failed to load bloggers:", e);
      setBloggers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, platform: string, id: string) => {
    e.stopPropagation();
    const newList = bloggers.filter(b => !(b.platform === platform && b.id === id));
    await storage.set('saved_bloggers', newList);
    setBloggers(newList);
  };

  const handleCreateMatrix = async () => {
    if (!newMatrixName.trim() || selectedForMerge.length === 0) return;
    const cleanName = newMatrixName.trim();
    
    const updatedList = bloggers.map(b => {
      const key = `${b.platform}-${b.id}`;
      if (selectedForMerge.includes(key)) {
        return { ...b, matrixName: cleanName };
      }
      return b;
    });
    
    await storage.set('saved_bloggers', updatedList);
    setBloggers(updatedList);
    setSelectedForMerge([]);
    setMergeMode(false);
    setShowMatrixModal(false);
    setNewMatrixName('');
  };

  const handleRemoveFromMatrix = async (e: React.MouseEvent, platform: string, id: string) => {
    e.stopPropagation();
    const updatedList = bloggers.map(b => {
      if (b.platform === platform && b.id === id) {
        return { ...b, matrixName: undefined }; // Remove matrix affiliation
      }
      return b;
    });
    await storage.set('saved_bloggers', updatedList);
    setBloggers(updatedList);
  };

  const toggleSelectForMerge = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setSelectedForMerge(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleUpdate = async (e: React.MouseEvent, platform: string, id: string) => {
    e.stopPropagation();
    if (updatingId) return;
    
    setUpdatingId(`${platform}-${id}`);
    try {
        const mode = 'user';
        const profileData = await fetchUserProfile(platform as PlatformType, id, mode);
        const listKey = 'saved_bloggers';
        let savedList = await storage.get<UnifiedUserProfile[]>(listKey) || [];
        const existingIdx = savedList.findIndex(b => b.platform === profileData.platform && b.id === profileData.id);
        
        if (existingIdx >= 0) {
            savedList[existingIdx] = profileData;
        } else {
            savedList.push(profileData);
        }
        await storage.set(listKey, savedList);
        setBloggers(savedList);
        
        const videoRes = await fetchUserVideos(platform as PlatformType, profileData.id, 0, 0, mode, 0);
        await storage.set(`saved_videos_${platform}_${profileData.id}`, videoRes.videos);
        
    } catch (err: any) {
        alert(`更新失败: ${err.message}`);
    } finally {
        setUpdatingId(null);
    }
  };

  const filteredBloggers = activeFilter === '全部' 
    ? bloggers 
    : bloggers.filter(b => b.platform === activeFilter);

  const renderCard = (blogger: UnifiedUserProfile) => {
    const proxiedAvatar = getProxiedAvatar(blogger.avatar, blogger.nickname);
    const bloggerKey = `${blogger.platform}-${blogger.id}`;
    const isFlipped = flippedCards[bloggerKey];
    const bData = monitorData[bloggerKey];
    const isSelected = selectedForMerge.includes(bloggerKey);

    return (
      <div 
        key={bloggerKey}
        className={cn(
            "relative perspective-[1000px] flex flex-col h-full min-h-[260px] transition-all duration-700",
            (selectMode || mergeMode) && "cursor-pointer",
            isFlipped && bData ? "row-span-2 min-h-[520px]" : "",
            mergeMode && isSelected && "ring-2 ring-indigo-500 rounded-xl"
        )}
        onClick={(e) => {
            if (mergeMode) {
              toggleSelectForMerge(e, bloggerKey);
              return;
            }
            if (selectMode) {
                onBloggerClick(blogger.platform, blogger.id, 'view', blogger);
            }
        }}
      >
        {mergeMode && (
          <div className="absolute top-2 left-2 z-30">
            <div className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm",
              isSelected 
                ? "bg-indigo-600 border-none text-white shadow-md shadow-indigo-300"
                : "bg-white/80 border-2 border-slate-300 hover:border-indigo-400"
            )}>
              {isSelected && <Check size={14} strokeWidth={3} />}
            </div>
          </div>
        )}

        <div className={cn("w-full h-full relative transition-all duration-700 [transform-style:preserve-3d]", isFlipped ? "[transform:rotateY(180deg)]" : "")}>
          
          {/* Front Face */}
          <div className={cn("absolute inset-0 bg-white rounded-xl md:rounded-2xl p-2 md:p-4 border border-slate-100 shadow-sm transition-all duration-300 flex flex-col [backface-visibility:hidden]")}>
            {/* Delete Button */}
            {(!selectMode && !mergeMode) && (
              <button
                onClick={(e) => handleDelete(e, blogger.platform, blogger.id)}
                className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors z-20 focus:opacity-100 outline-none"
                title="删除"
              >
                <X size={14} strokeWidth={3} />
              </button>
            )}

            {/* Matrix label indicator */}
            {!mergeMode && blogger.matrixName && viewMode === 'account' && (
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 line-clamp-1 max-w-[60px] cursor-help" title={`归属矩阵: ${blogger.matrixName}`}>
                {blogger.matrixName}
              </div>
            )}

            {/* Card Header: Avatar & Nickname */}
            <div className="flex flex-col items-center gap-1.5 md:gap-3 text-center mb-auto pt-2">
              <div className="relative">
                <img 
                  src={proxiedAvatar} 
                  alt={blogger.nickname} 
                  className="w-10 h-10 md:w-16 md:h-16 rounded-full object-cover shadow-sm bg-slate-50 transition-transform duration-500 hover:scale-110" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('ui-avatars.com')) {
                      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(blogger.nickname)}&background=random`;
                    }
                  }}
                />
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-4 h-4 md:w-6 md:h-6 rounded-full border-2 border-white flex items-center justify-center text-[6px] md:text-[7px] font-black text-white shadow-sm z-10",
                  blogger.platform === '抖音' ? 'bg-black' :
                  blogger.platform === 'B站' ? 'bg-[#FF6699]' :
                  blogger.platform === '小红书' ? 'bg-[#FF2442]' :
                  blogger.platform === '微博' ? 'bg-orange-500' : 'bg-blue-500'
                )}>
                  {blogger.platform.charAt(0)}
                </div>
              </div>
              <div className="min-w-0 w-full">
                <h3 className="text-[10px] md:text-sm font-black text-slate-900 truncate hover:text-blue-600 transition-colors">
                  {blogger.nickname || '未知用户'}
                </h3>
              </div>
            </div>

            {/* Stats Bench */}
            <div className={cn(
              "grid mt-2 md:mt-4 p-1.5 md:p-2 bg-slate-50/50 rounded-lg md:rounded-xl border border-slate-100 gap-0.5 md:gap-1 text-center shrink-0",
              blogger.platform === '小红书' ? "grid-cols-2" : "grid-cols-3"
            )}>
              <div className="min-w-0">
                <div className="text-[9px] md:text-[11px] font-black text-blue-600 truncate">{formatNumber(blogger.followerCount)}</div>
                <div className="text-[6px] md:text-[7px] font-bold text-slate-400 truncate uppercase">粉丝</div>
              </div>
              <div className="min-w-0">
                <div className="text-[9px] md:text-[11px] font-black text-rose-500 truncate">{formatNumber(blogger.likeCount) || '-'}</div>
                <div className="text-[6px] md:text-[7px] font-bold text-slate-400 truncate uppercase">获赞</div>
              </div>
              {blogger.platform !== '小红书' && (
                <div className="min-w-0">
                  <div className="text-[9px] md:text-[11px] font-black text-slate-900 truncate">{blogger.videoCount || '-'}</div>
                  <div className="text-[6px] md:text-[7px] font-bold text-slate-400 truncate uppercase">作品</div>
                </div>
              )}
            </div>

            {/* Card Actions */}
            {!selectMode && (
              <div className={cn("grid mt-auto pt-2 shrink-0 gap-1 md:gap-2", bData ? "grid-cols-3" : "grid-cols-2")}>
                <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      if (mergeMode) return;
                      onBloggerClick(blogger.platform, blogger.id, 'view');
                  }}
                  disabled={mergeMode}
                  className="py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black transition-all active:scale-95 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-50"
                >
                  查看
                </button>
                <button 
                  onClick={(e) => handleUpdate(e, blogger.platform, blogger.id)}
                  disabled={updatingId === bloggerKey || mergeMode}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingId === bloggerKey ? (
                     <>
                       <Loader2 size={12} className="animate-spin" />
                       更新中
                     </>
                  ) : '更新'}
                </button>
                {bData && (
                  <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (mergeMode) return;
                        setFlippedCards(prev => ({ ...prev, [bloggerKey]: true }));
                    }}
                    disabled={mergeMode}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    分析
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Back Face */}
          <div className="absolute inset-0 bg-slate-900 rounded-xl md:rounded-2xl p-3 md:p-4 border border-indigo-500/30 flex flex-col [transform:rotateY(180deg)] [backface-visibility:hidden] overflow-hidden">
            {bData ? (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-3 shrink-0">
                  <h4 className="text-xs md:text-sm font-black text-indigo-400">AI 智能监控</h4>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlippedCards(prev => ({ ...prev, [bloggerKey]: false }));
                    }}
                    className="bg-slate-800 text-slate-400 hover:text-white px-2 py-1 rounded-md text-[10px] transition-colors z-20"
                  >
                    返回
                  </button>
                </div>
                
                <div className="h-[140px] md:h-[160px] shrink-0 w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bData.metrics} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? (v/1000).toFixed(1)+'k' : v} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px', color: '#f8fafc' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        cursor={{ fill: '#1e293b' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '9px', color: '#64748b' }} iconSize={6} />
                      <Bar dataKey="average" name="历史均值" fill="#334155" radius={[2, 2, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="current" name="最新视频" fill="#818cf8" radius={[2, 2, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                   <div className="mb-3 bg-indigo-500/10 p-2.5 rounded-lg border border-indigo-500/20">
                     <p className="text-[10px] md:text-xs font-bold text-indigo-300 leading-relaxed text-left">{bData.commentSummary}</p>
                   </div>
                   <div className="pb-2">
                     <p className="text-[10px] md:text-[11px] text-slate-300 leading-relaxed font-medium text-left">
                       {bData.analysis}
                     </p>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full items-center justify-center">
                 <h4 className="text-sm font-black text-slate-500">无监控数据</h4>
                 <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setFlippedCards(prev => ({ ...prev, [bloggerKey]: false }));
                  }}
                  className="mt-4 bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors z-20"
                >
                  返回正面
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const matrixGroups = filteredBloggers.reduce((acc, curr) => {
    const key = curr.matrixName || '未归属';
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {} as Record<string, UnifiedUserProfile[]>);

  if (loading) {
    return <div className="flex-1 flex justify-center items-center font-sans mt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  return (
    <div className="flex-1 p-8 md:p-12 lg:p-16 max-w-7xl mx-auto w-full font-sans animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-start justify-between gap-5 mb-10">
        <div className="flex items-start gap-5">
          <div className="bg-blue-600/10 p-3.5 rounded-2xl shadow-sm text-blue-600">
            <Users size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              {selectMode ? '请选择需要模拟投流的博主' : '博主信息库'}
            </h1>
            <p className="text-slate-500 mt-2 font-medium text-lg leading-relaxed">
              {selectMode ? '从已保存的库中挑选一位博主为您进行全平台曝光预估演练。' : '在这里管理和查看您之前抓取过的博主信息与视频数据。'}
            </p>
          </div>
        </div>
        
        {!selectMode && (
          <button 
            onClick={handleAutoMonitor}
            disabled={isMonitoring || filteredBloggers.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMonitoring ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <BarChart2 size={18} />
            )}
            {isMonitoring ? '全网监控中...' : '自动监控'}
          </button>
        )}
      </div>

      {/* Controls & Filter */}
      <div className="flex flex-col gap-6 mb-10">
        <div className="flex justify-between items-center bg-white p-2 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100">
          <div className="flex gap-2">
            {!selectMode && (
              <button
                onClick={() => { setViewMode('account'); setMergeMode(false); }}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                  viewMode === 'account' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                )}
              >
                按账号展示
              </button>
            )}
            <button
              onClick={() => { setViewMode('matrix'); setMergeMode(false); }}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                viewMode === 'matrix' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              )}
            >
              按矩阵展示
            </button>
          </div>
          
          {viewMode === 'account' && !selectMode && (
            <div className="flex items-center gap-3 pr-2">
              {mergeMode ? (
                <>
                  <button
                    onClick={() => { setMergeMode(false); setSelectedForMerge([]); }}
                    className="text-sm font-bold text-slate-400 hover:text-slate-600 px-4 py-2"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => setShowMatrixModal(true)}
                    disabled={selectedForMerge.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-all"
                  >
                    合并为矩阵 ({selectedForMerge.length})
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setMergeMode(true)}
                  className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-all"
                >
                  <Layers size={16} />
                  跨平台归组
                </button>
              )}
            </div>
          )}
        </div>

        {viewMode === 'account' && (
          <div className="grid grid-cols-4 gap-1 md:gap-2 w-full">
            {platformsFilter.map(p => (
              <button
                key={p}
                onClick={() => setActiveFilter(prev => prev === p ? '全部' : p)}
                className={cn(
                  "px-0.5 py-1.5 rounded-lg text-[9px] md:text-[11px] font-black transition-all border text-center truncate",
                  activeFilter === p 
                    ? "bg-blue-600 text-white border-blue-600 shadow-md active:scale-95" 
                    : "bg-white text-slate-500 border-slate-100 hover:border-slate-300 shadow-sm active:scale-95 hover:bg-slate-50"
                )}
                title={p}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredBloggers.length === 0 ? (
        <div className="text-slate-400 text-center py-32 bg-white border border-dashed border-slate-200 rounded-[48px] shadow-sm">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={32} strokeWidth={2} className="opacity-40" />
          </div>
          <p className="text-2xl font-bold text-slate-700">没有找到相关的博主记录</p>
          <p className="text-slate-400 mt-2 font-medium">您可以尝试查看其他平台或者抓取新的博主数据</p>
        </div>
      ) : (
        viewMode === 'account' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6 grid-flow-row-dense">
            {filteredBloggers.map(renderCard)}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(matrixGroups).sort(([a], [b]) => a === '未归属' ? 1 : b === '未归属' ? -1 : a.localeCompare(b)).map(([groupName, members]) => {
              const totalFollowers = members.reduce((sum, b) => sum + (b.followerCount || 0), 0);
              return (
                <div key={groupName} className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
                        <Layers size={20} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-900">{groupName}</h2>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">共 {members.length} 个跨平台账号</p>
                      </div>
                    </div>
                    {groupName !== '未归属' && !selectMode && (
                      <div className="text-right">
                        <div className="text-xl md:text-2xl font-black text-blue-600">{formatNumber(totalFollowers)}</div>
                        <div className="text-xs font-bold text-slate-400">全网粉丝汇总概览</div>
                      </div>
                    )}
                    {groupName !== '未归属' && selectMode && (
                      <div className="text-right flex items-center justify-end">
                        <button
                          onClick={() => onMatrixSelect?.(groupName, members)}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors"
                        >
                          选择此矩阵参与模拟
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6 grid-flow-row-dense pt-2">
                    {members.map(renderCard)}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Merge Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">合并为新矩阵</h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">已选择 {selectedForMerge.length} 个账号，请输入该 IP 矩阵名称。</p>
            </div>
            
            <input
              type="text"
              autoFocus
              value={newMatrixName}
              onChange={(e) => setNewMatrixName(e.target.value)}
              placeholder="如：Papi酱、董宇辉..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-bold"
            />

            <div className="flex justify-end gap-3 mt-2">
              <button 
                onClick={() => setShowMatrixModal(false)}
                className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
              >
                取消
              </button>
              <button 
                onClick={handleCreateMatrix}
                disabled={!newMatrixName.trim()}
                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
              >
                <Check size={16} strokeWidth={3} />
                确认合并
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
