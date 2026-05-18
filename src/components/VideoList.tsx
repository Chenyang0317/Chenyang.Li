import React, { useState, useEffect } from 'react';
import { UnifiedVideo, fetchVideoComments } from '../lib/platforms';
import { Heart, MessageCircle, Bookmark, Share2, PlayCircle, FileText, Eye, X, Play, Sparkles, RotateCcw, Copy, Check } from 'lucide-react';
import { formatNumber, cn, getProxiedAvatar } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeVideo, analyzeMultiVideos, analyzeMultiVideoComments, VideoAnalysisResult, CommentAnalysisResult } from '../lib/gemini';
import Markdown from 'react-markdown';

type InsightModeType = 'none' | 'video' | 'comment';

interface VideoListProps {
  videos: UnifiedVideo[];
  loading: boolean;
  error: string | null;
  totalItems?: number;
  onSortChange: (sortType: number) => void;
  currentSort: number;
  onAuthorClick?: (platform: string, authorId: string) => void;
  publishTime?: number;
  onPublishTimeChange?: (time: number) => void;
  platform?: string;
  isAnalysisMode?: boolean;
  profile?: any;
}

export function VideoListView({ videos, loading, error, totalItems = 0, onSortChange, currentSort, onAuthorClick, publishTime = 0, onPublishTimeChange, platform, isAnalysisMode, profile }: VideoListProps) {
  const [selectedVideo, setSelectedVideo] = useState<UnifiedVideo | null>(null);
  const [insightMode, setInsightMode] = useState<InsightModeType>('none');
  const [selectedForInsight, setSelectedForInsight] = useState<Set<string>>(new Set());
  const [multiInsightResult, setMultiInsightResult] = useState<(VideoAnalysisResult & { count: number }) | null>(null);
  const [multiCommentResult, setMultiCommentResult] = useState<(CommentAnalysisResult & { count: number }) | null>(null);
  const [isInsightCollapsed, setIsInsightCollapsed] = useState(false);
  const [isCommentCollapsed, setIsCommentCollapsed] = useState(false);
  const [isAnalyzingMulti, setIsAnalyzingMulti] = useState(false);
  const [multiAnalysisError, setMultiAnalysisError] = useState<string | null>(null);
  const [isMultiCopied, setIsMultiCopied] = useState(false);

  const handleCopyMulti = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsMultiCopied(true);
    setTimeout(() => setIsMultiCopied(false), 2000);
  };

  const handleToggleInsightSelection = (videoId: string) => {
    setSelectedForInsight(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const handleStartMultiInsight = async () => {
    if (selectedForInsight.size === 0) return;
    setIsAnalyzingMulti(true);
    setMultiAnalysisError(null);
    
    if (insightMode === 'video') {
      setMultiInsightResult(null);
    } else if (insightMode === 'comment') {
      setMultiCommentResult(null);
    }
    
    try {
      const selectedVideosData = videos.filter(v => selectedForInsight.has(v.id));
      if (insightMode === 'video') {
        const res = await analyzeMultiVideos(selectedVideosData);
        setMultiInsightResult({ ...res, count: selectedForInsight.size });
        setIsInsightCollapsed(false);
      } else if (insightMode === 'comment') {
        const videosWithComments = await Promise.all(selectedVideosData.map(async (v) => {
           let comments: any[] = [];
           try {
             // We map to fetchVideoComments with platform
             const cRes = await fetchVideoComments(v.platform, String(v.id), 0, 30);
             comments = cRes.comments;
           } catch(err) {
             console.error(`Fetch comments failed for video ${v.id}`, err);
           }
           return { ...v, comments };
        }));
        const res = await analyzeMultiVideoComments(videosWithComments);
        setMultiCommentResult({ ...res, count: selectedForInsight.size });
        setIsCommentCollapsed(false);
      }
      setInsightMode('none');
    } catch (e: any) {
      setMultiAnalysisError(e.message || '分析失败，请重试');
    } finally {
      setIsAnalyzingMulti(false);
    }
  };

  
  if (loading && videos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && videos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  if (videos.length === 0) {
     const isHashtag = profile?.nickname?.startsWith('#');
     return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 min-h-[400px]">
          <FileText size={48} className="mb-4 opacity-50" />
          <p>{isHashtag ? '暂未解析到该话题下的相关视频' : '暂无数据，请检查 ID 是否正确'}</p>
        </div>
     )
  }

  const isHashtag = profile?.nickname?.startsWith('#');

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3 min-h-[40px]">
           {!isHashtag && (
             <>
               <FileText className="text-blue-600" size={24} />
               <h2 className="text-xl font-bold text-slate-800">
                 {isAnalysisMode ? '原有的视频数据' : '当前的视频数据'}
               </h2>
               <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-2.5 py-1 rounded-full uppercase ml-2">
                 {videos.length} ITEMS
               </span>
             </>
           )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {platform === '抖音' && isHashtag && onPublishTimeChange && (
            <div className="flex bg-slate-100/80 rounded-full p-1 border border-slate-200">
              {[
                { label: '不限', value: 0 },
                { label: '最近一天', value: 1 },
                { label: '最近一周', value: 7 },
                { label: '最近半年', value: 180 }
              ].map(opt => (
                <button 
                  key={opt.value}
                  onClick={() => onPublishTimeChange(opt.value)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-medium transition-all shadow-sm whitespace-nowrap",
                    publishTime === opt.value ? "bg-white text-blue-600 shadow" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex bg-slate-100/80 rounded-full p-1 border border-slate-200">
           <button 
             onClick={() => onSortChange(0)}
             className={cn(
               "px-6 py-2 rounded-full text-sm font-medium transition-all shadow-sm",
               currentSort === 0 ? "bg-white text-blue-600 shadow" : "text-slate-500 hover:text-slate-800"
             )}
           >
             最新发布
           </button>
           <button 
             onClick={() => onSortChange(1)}
             className={cn(
               "px-6 py-2 rounded-full text-sm font-medium transition-all shadow-sm",
               currentSort === 1 ? "bg-white text-blue-600 shadow" : "text-slate-500 hover:text-slate-800"
             )}
           >
             {platform === 'B站' ? '最多播放' : '最多点赞'}
           </button>
           {platform === 'B站' && (
             <button 
               onClick={() => onSortChange(2)}
               className={cn(
                 "px-6 py-2 rounded-full text-sm font-medium transition-all shadow-sm",
                 currentSort === 2 ? "bg-white text-blue-600 shadow" : "text-slate-500 hover:text-slate-800"
               )}
             >
               最多收藏
             </button>
           )}
           <div className="w-[1px] h-4 bg-slate-200 mx-1 my-auto"></div>
           <button
             onClick={() => {
                 const newMode = insightMode === 'video' ? 'none' : 'video';
                 setInsightMode(newMode);
                 if (newMode === 'none') setSelectedForInsight(new Set());
             }}
             className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm flex items-center gap-1",
                insightMode === 'video' ? "bg-purple-600 text-white shadow-purple-200" : "text-purple-600 hover:bg-white hover:shadow-sm"
             )}
           >
             <Sparkles size={16} /> 视频洞察
           </button>
           <button
             onClick={() => {
                 const newMode = insightMode === 'comment' ? 'none' : 'comment';
                 setInsightMode(newMode);
                 if (newMode === 'none') setSelectedForInsight(new Set());
             }}
             className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm flex items-center gap-1",
                insightMode === 'comment' ? "bg-blue-600 text-white shadow-blue-200" : "text-blue-600 hover:bg-white hover:shadow-sm"
             )}
           >
             <MessageCircle size={16} /> 评论分析
           </button>
          </div>
        </div>
      </div>

      {insightMode !== 'none' && (
        <div className={cn("mb-6 p-4 rounded-2xl border flex items-center justify-between shadow-sm", insightMode === 'video' ? "bg-purple-50 border-purple-100" : "bg-blue-50 border-blue-100")}>
           <div className={cn("flex items-center gap-2", insightMode === 'video' ? "text-purple-700" : "text-blue-700")}>
             {insightMode === 'video' ? <Sparkles size={20} /> : <MessageCircle size={20} />}
             <span className="font-bold sm:text-sm text-xs">
               请点击下方视频进行多选，
               {insightMode === 'video' ? "最多建议选择 5-10 个优质视频进行共性分析寻找爆款公式" : "提取并分析这批视频的高频评论与用户洞察"}
             </span>
           </div>
           <div className="flex items-center gap-3">
             <span className={cn("text-sm font-medium", insightMode === 'video' ? "text-purple-600" : "text-blue-600")}>已选择 <span className="font-bold">{selectedForInsight.size}</span> 个</span>
             <button
               onClick={handleStartMultiInsight}
               disabled={selectedForInsight.size === 0 || isAnalyzingMulti}
               className={cn("px-6 py-2 text-white rounded-full font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm",
                 insightMode === 'video' ? "bg-gradient-to-r from-purple-600 to-blue-600" : "bg-gradient-to-r from-blue-600 to-cyan-600"
               )}
             >
               {isAnalyzingMulti ? '分析中...' : '确定分析'}
             </button>
           </div>
        </div>
      )}

      {multiAnalysisError && (
        <div className="mb-6 p-4 bg-red-50 text-red-500 rounded-2xl border border-red-100 flex items-center justify-between">
           <span className="font-bold text-sm flex items-center gap-2"><X size={18} /> {multiAnalysisError}</span>
           <button onClick={() => setMultiAnalysisError(null)} className="p-1.5 hover:bg-red-100 rounded-full transition-colors">
             <X size={16} />
           </button>
        </div>
      )}

      {multiInsightResult && (
        <div className="mb-8 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-blue-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
           <div className={cn("p-6 md:px-8 flex items-center justify-between", isInsightCollapsed ? "pb-6" : "pb-4")}>
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center border border-purple-100/50">
                 <Sparkles className="text-purple-600" size={24} />
               </div>
               <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">爆款公式与共性分析</h3>
                    <button 
                      onClick={() => handleCopyMulti(multiInsightResult.summary)}
                      className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-purple-600 transition-all active:scale-95"
                      title="复制全案总结"
                    >
                      {isMultiCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-[13px] text-slate-500 font-medium mt-1">基于分析时选定的 <span className="text-purple-600 font-bold">{multiInsightResult.count}</span> 个视频智能提炼</p>
               </div>
             </div>
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsInsightCollapsed(!isInsightCollapsed)} 
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full transition-all text-xs font-bold border border-slate-200/60"
                >
                  {isInsightCollapsed ? <PlayCircle size={14} className="rotate-90" /> : <PlayCircle size={14} className="-rotate-90" />}
                  {isInsightCollapsed ? '展开分析' : '收起内容'}
                </button>
                <button onClick={() => setMultiInsightResult(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2.5 rounded-full transition-colors focus:outline-none" title="关闭">
                  <X size={20} />
                </button>
             </div>
           </div>
           
           <AnimatePresence>
             {!isInsightCollapsed && (
               <motion.div 
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: 'auto', opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 transition={{ duration: 0.3, ease: 'easeInOut' }}
                 className="px-6 md:px-8 pb-8"
               >
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mt-4">
                   <div className="bg-slate-50/60 rounded-3xl border border-slate-100 p-6">
                      <div className="flex items-center gap-2 mb-5 text-slate-800 font-black text-sm uppercase tracking-wider">
                        <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
                        核心爆点洞察
                      </div>
                      <div className="prose prose-sm prose-slate max-w-none">
                        <div className="markdown-body text-sm leading-8 text-slate-700">
                          <Markdown>{String(multiInsightResult.summary || '')}</Markdown>
                        </div>
                      </div>
                   </div>
                   
                   <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-6 text-slate-800 font-black text-sm uppercase tracking-wider">
                        <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                        标准参考脚本结构
                      </div>
                      <div className="space-y-4 relative">
                        <div className="absolute left-[15px] top-2 bottom-2 w-[1.5px] bg-gradient-to-b from-blue-100 via-slate-100 to-blue-50" />
                        {multiInsightResult.structure.map((item, idx) => (
                          <div key={idx} className="relative flex items-start gap-5">
                            <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-[3px] border-white bg-white shadow-sm flex items-center justify-center transition-transform hover:scale-110">
                               {item.type === 'vo' ? (
                                 <div className="w-3.5 h-3.5 bg-blue-500 rounded-[3px] rotate-45" />
                               ) : (
                                 <div className="w-3 h-3 border-[2.5px] border-slate-300 rounded-full" />
                               )}
                            </div>
                            <div className="flex-1 min-w-0 bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-blue-200 transition-all hover:bg-white hover:shadow-md group">
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="text-[11px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 uppercase tracking-tight">
                                  {item.tag}
                                </div>
                                <div className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded uppercase tracking-wider border border-slate-100 shadow-sm">
                                  ≈ {item.duration.toFixed(1)}s
                                </div>
                              </div>
                              {item.vo && (
                                <div className="mb-3 relative">
                                  <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-200 rounded-full opacity-40" />
                                  <p className="text-[13px] text-slate-700 leading-relaxed font-medium pl-3 italic">
                                    &ldquo;{item.vo}&rdquo;
                                  </p>
                                </div>
                              )}
                              <div className="flex items-start gap-2 text-xs text-slate-500 bg-white p-3 rounded-xl border border-dashed border-slate-200 shadow-sm">
                                <FileText size={16} className="shrink-0 mt-0.5 opacity-60 text-slate-400" />
                                <span className="leading-snug">{item.videoDescription}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      )}

      {multiCommentResult && (
        <div className="mb-8 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-cyan-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
           <div className={cn("p-6 md:px-8 flex items-center justify-between", isCommentCollapsed ? "pb-6" : "pb-4")}>
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100/50">
                 <MessageCircle className="text-blue-600" size={24} />
               </div>
               <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">热点评论洞察</h3>
                    <button 
                      onClick={() => handleCopyMulti(multiCommentResult.summary)}
                      className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-blue-600 transition-all active:scale-95"
                      title="复制评论洞察"
                    >
                      {isMultiCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-[13px] text-slate-500 font-medium mt-1">基于分析时选定的 <span className="text-blue-600 font-bold">{multiCommentResult.count}</span> 个视频的评论深度挖掘</p>
               </div>
             </div>
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsCommentCollapsed(!isCommentCollapsed)} 
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full transition-all text-xs font-bold border border-slate-200/60"
                >
                  {isCommentCollapsed ? <PlayCircle size={14} className="rotate-90" /> : <PlayCircle size={14} className="-rotate-90" />}
                  {isCommentCollapsed ? '展开分析' : '收起内容'}
                </button>
                <button onClick={() => setMultiCommentResult(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2.5 rounded-full transition-colors focus:outline-none" title="关闭">
                  <X size={20} />
                </button>
             </div>
           </div>
           
           <AnimatePresence>
             {!isCommentCollapsed && (
               <motion.div 
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: 'auto', opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 transition={{ duration: 0.3, ease: 'easeInOut' }}
                 className="px-6 md:px-8 pb-8"
               >
                 <div className="bg-slate-50/60 rounded-3xl border border-slate-100 p-6 mt-4">
                    <div className="flex items-center gap-2 mb-5 text-slate-800 font-black text-sm uppercase tracking-wider">
                      <span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>
                      洞察分析报告
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <div className="markdown-body text-sm leading-8 text-slate-700">
                        <Markdown>{String(multiCommentResult.summary || '')}</Markdown>
                      </div>
                    </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {videos.map((video) => (
          <div key={video.id} className="relative group/wrapper">
            <VideoCard 
              video={video} 
              onPlay={() => {
                if (insightMode !== 'none') {
                  handleToggleInsightSelection(video.id);
                } else {
                  setSelectedVideo(video);
                }
              }} 
              onAuthorClick={onAuthorClick}
              isMultiInsightMode={insightMode !== 'none'}
              isSelectedForInsight={selectedForInsight.has(video.id)}
              onToggleInsightSelection={() => handleToggleInsightSelection(video.id)}
            />
          </div>
        ))}
      </div>
      
      {loading && (
        <div className="w-full flex justify-center py-8">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVideo(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg aspect-[9/16] bg-black rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
            >
              <button 
                onClick={() => setSelectedVideo(null)}
                className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"
                title="关闭"
              >
                <X size={20} />
              </button>
              
              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                {selectedVideo.videoUrl ? (
                  <video 
                    src={selectedVideo.videoUrl} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-contain"
                    playsInline
                    {...({ referrerPolicy: "no-referrer" } as any)}
                  />
                ) : (
                  <div className="text-center text-slate-500 p-8">
                    <PlayCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-white font-bold">暂无有效播放地址</p>
                    <p className="text-xs mt-2">该视频可能由于平台限制无法直接播放</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
                  <h4 className="text-white font-bold text-sm leading-relaxed line-clamp-2">
                    {selectedVideo.title}
                  </h4>
                  <div className="flex items-center gap-5 mt-4">
                    <div className="flex items-center gap-2 text-white/90">
                      <Heart size={16} className="text-red-500 fill-red-500" />
                      <span className="text-[10px] font-black tracking-widest">{formatNumber(selectedVideo.stats.likeCount)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90">
                      <MessageCircle size={16} className="text-blue-400" />
                      <span className="text-[10px] font-black tracking-widest">{formatNumber(selectedVideo.stats.commentCount)}</span>
                    </div>
                  </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VideoCard({ 
  video, 
  onPlay, 
  onAuthorClick,
  isMultiInsightMode,
  isSelectedForInsight,
  onToggleInsightSelection
}: { 
  video: UnifiedVideo; 
  onPlay: () => void; 
  onAuthorClick?: (p: string, id: string) => void;
  isMultiInsightMode?: boolean;
  isSelectedForInsight?: boolean;
  onToggleInsightSelection?: () => void;
}) {
  const [flipMode, setFlipMode] = useState<'none' | 'insight' | 'comment' | 'commentList'>('none');
  const isFlipped = flipMode !== 'none';
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [commentAnalysisResult, setCommentAnalysisResult] = useState<CommentAnalysisResult | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const { author, stats, createTime, title, coverUrl, id, platform } = video;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    if (flipMode === 'insight' && !analysisResult && !isAnalyzing && !analysisError) {
      const doAnalyze = async () => {
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
          const res = await analyzeVideo(video);
          setAnalysisResult(res);
        } catch (e: any) {
          setAnalysisError(e.message || '分析失败，请重试');
        } finally {
          setIsAnalyzing(false);
        }
      };
      doAnalyze();
    } else if (flipMode === 'comment' && !commentAnalysisResult && !isAnalyzing && !analysisError) {
      const doAnalyzeComment = async () => {
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
          let comments: any[] = [];
          try {
            const cRes = await fetchVideoComments(platform, String(id), 0, 30);
            comments = cRes.comments;
          } catch(err) {
            console.error(`Fetch comments failed for video ${id}`, err);
          }
          const videoWithComments = { ...video, comments };
          const res = await analyzeMultiVideoComments([videoWithComments]);
          setCommentAnalysisResult(res);
        } catch (e: any) {
          setAnalysisError(e.message || '分析失败，请重试');
        } finally {
          setIsAnalyzing(false);
        }
      };
      doAnalyzeComment();
    } else if (flipMode === 'commentList' && commentsList.length === 0 && !isLoadingComments && !analysisError) {
      const doFetchComments = async () => {
        setIsLoadingComments(true);
        setAnalysisError(null);
        try {
          // 只获取20条最热门评论
          const cRes = await fetchVideoComments(platform, String(id), 0, 20);
          setCommentsList(cRes.comments?.slice(0, 20) || []);
        } catch (e: any) {
          setAnalysisError(e.message || '获取评论列表失败');
        } finally {
          setIsLoadingComments(false);
        }
      };
      doFetchComments();
    }
  }, [flipMode, isAnalyzing, isLoadingComments, analysisResult, commentAnalysisResult, commentsList.length, analysisError, video, platform, id]);

  return (
    <div className="relative w-full h-full" style={{ perspective: 1000 }}>
      <motion.div 
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        className="w-full h-full relative"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <div 
          className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col group hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all h-full"
          style={{ backfaceVisibility: 'hidden' }}
        >
           {/* User Info Header */}
           <div className="flex items-center gap-3 mb-4">
             <div 
               className={cn(
                 "relative shrink-0",
                 onAuthorClick && "cursor-pointer"
               )}
               onClick={() => onAuthorClick?.(platform || '抖音', author.id)}
             >
               <img 
                 src={getProxiedAvatar(author.avatar, author.nickname)} 
                 alt={author.nickname} 
                 className="w-10 h-10 rounded-full object-cover border border-slate-100 transition-transform group-hover:scale-105"
                 referrerPolicy="no-referrer"
                 onError={(e) => {
                   const target = e.target as HTMLImageElement;
                   if (!target.src.includes('ui-avatars.com')) {
                     target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(author.nickname)}&background=random&color=fff`;
                   }
                 }}
               />
               {platform && (
                 <div className={cn(
                   "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[6px] font-black text-white shadow-sm",
                   platform === '抖音' ? 'bg-black' :
                   platform === 'B站' ? 'bg-[#FF6699]' :
                   platform === '小红书' ? 'bg-[#FF2442]' :
                   platform === '微博' ? 'bg-orange-500' : 'bg-blue-500'
                 )}>
                   {platform.charAt(0)}
                 </div>
               )}
             </div>
             <div 
               className={cn(
                 "flex-1 min-w-0",
                 onAuthorClick && "cursor-pointer group/name"
               )}
               onClick={() => onAuthorClick?.(platform || '抖音', author.id)}
             >
               <h3 className="font-bold text-slate-800 text-sm truncate group-hover/name:text-blue-600 transition-colors">{author.nickname}</h3>
               <p className="text-[10px] text-slate-400 font-mono truncate">ID: {author.id}</p>
             </div>
             <button 
               onClick={(e) => {
                 if (isMultiInsightMode) {
                   e.stopPropagation();
                   onToggleInsightSelection?.();
                 } else {
                   setFlipMode('insight');
                 }
               }}
               className={cn(
                 "p-1.5 rounded-full transition-all focus:outline-none flex items-center justify-center border-2",
                 isMultiInsightMode
                   ? isSelectedForInsight 
                     ? "bg-purple-600 border-purple-600 shadow-sm"
                     : "bg-white border-slate-300 hover:border-purple-400"
                   : "hover:bg-purple-50 border-transparent"
               )}
               title={isMultiInsightMode ? (isSelectedForInsight ? "取消选择" : "选择视频") : "AI 视频分析"}
               style={isMultiInsightMode ? { width: '28px', height: '28px' } : undefined}
             >
               {isMultiInsightMode ? (
                 isSelectedForInsight ? <div className="w-2.5 h-2.5 bg-white rounded-[2px]" /> : null
               ) : (
                 <Sparkles size={18} className="text-purple-400 group-hover:text-purple-600 transition-colors" />
               )}
             </button>
           </div>
    
           {/* Title */}
           <p className="text-xs font-semibold text-slate-800 mb-3 line-clamp-2 leading-relaxed h-8">
             {title}
           </p>
    
           {/* Video Cover */}
           <div 
             className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-slate-100 mb-4 isolate border border-slate-50 cursor-pointer"
             onClick={onPlay}
           >
              {coverUrl ? (
                <img src={coverUrl} alt="cover" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                   <FileText size={24} className="opacity-20 mb-2" />
                   <span className="text-[10px] font-medium">无封面图</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10 opacity-60 group-hover:opacity-80 transition-opacity" />
              
              {/* Play Icon Hover Overlay */}
              <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                 <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/40 scale-90 group-hover:scale-100 transition-transform">
                    <Play size={24} className="text-white fill-white ml-1" />
                 </div>
              </div>
    
              {createTime > 0 && (
                <div className="absolute bottom-3 left-3 z-20 text-white/90 text-[10px] font-medium backdrop-blur-sm bg-black/20 px-2 py-0.5 rounded">
                  {format(new Date(createTime * 1000), 'MM-dd HH:mm')}
                </div>
              )}
           </div>
    
           {/* Stats Footer */}
           <div className="flex items-end justify-between mt-auto">
             <div className="flex flex-wrap gap-2">
                {stats.playCount !== undefined && <StatBadge icon={<Eye size={14} className="text-emerald-500" />} value={stats.playCount} />}
                <StatBadge icon={<Heart size={14} className="text-red-500" />} value={stats.likeCount} />
                <StatBadge 
                  icon={<MessageCircle size={14} className="text-blue-500" />} 
                  value={stats.commentCount} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setFlipMode('commentList');
                  }}
                />
                {platform !== '小红书' && <StatBadge icon={<Bookmark size={14} className="text-amber-500" />} value={stats.collectCount} />}
                {platform !== '小红书' && <StatBadge icon={<Share2 size={14} className="text-indigo-500" />} value={stats.shareCount} />}
             </div>
             {!isMultiInsightMode && (
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   setFlipMode('comment');
                 }}
                 className="ml-1 mt-1 hover:scale-110 active:scale-95 transition-all flex shrink-0 self-end group/btn focus:outline-none"
                 title="AI 评论洞察"
               >
                 <MessageCircle size={18} className="text-purple-500 fill-purple-50 transition-colors" />
               </button>
             )}
           </div>
        </div>

        {/* Back */}
        <div 
          className="absolute inset-0 bg-white rounded-3xl pb-0 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col h-full overflow-hidden"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex items-center justify-between p-4 pb-2 shrink-0 border-b border-slate-50 bg-white z-10">
             <div className={cn("flex items-center gap-2", flipMode === 'comment' ? "text-blue-600" : "text-purple-600")}>
               {flipMode === 'comment' ? <MessageCircle size={18} /> : <Sparkles size={18} />}
               <h3 className="font-bold text-sm">{flipMode === 'comment' ? 'AI 评论分析' : 'AI 视频分析'}</h3>
             </div>
             <button
               onClick={() => setFlipMode('none')}
               className="p-1.5 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-1 text-[10px] text-slate-400 font-bold"
               title="返回封面"
             >
                <span>返回</span>
                <RotateCcw size={14} className="text-slate-400" />
             </button>
          </div>
          <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-slate-50/30">
            {isAnalyzing ? (
               <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                 <motion.div 
                   animate={{ rotate: 360 }} 
                   transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                   className="relative"
                 >
                    {flipMode === 'comment' ? (
                       <MessageCircle size={40} className="mb-4 text-blue-400 blur-[0.5px]" />
                    ) : (
                       <Sparkles size={40} className="mb-4 text-purple-400 blur-[0.5px]" />
                    )}
                    <div className={cn("absolute inset-0 animate-ping opacity-20", flipMode === 'comment' ? "text-blue-400" : "text-purple-400")}>
                      {flipMode === 'comment' ? <MessageCircle size={40} /> : <Sparkles size={40} />}
                    </div>
                 </motion.div>
                 <p className="text-sm text-slate-500 font-bold tracking-wide">
                   {flipMode === 'comment' ? '正在提取高频反馈...' : '正在进行深度内容建模...'}
                 </p>
                 <p className="text-[10px] text-slate-300 mt-2 font-mono">GEMINI 2.5 FLASH POWERED</p>
               </div>
            ) : analysisError ? (
               <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                 <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                   <FileText size={32} className="text-red-300" />
                 </div>
                 <p className="text-sm text-red-500 font-bold mb-4">{analysisError}</p>
                 <button 
                   onClick={() => setAnalysisError(null)} 
                   className="px-6 py-2 text-xs font-bold text-white bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                 >
                   再次尝试
                 </button>
               </div>
            ) : flipMode === 'commentList' ? (
               <div className="p-4 space-y-4">
                 <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider mb-4">
                      <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                      最热评论 (Top 20)
                    </div>
                    {isLoadingComments ? (
                      <div className="flex justify-center p-4">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                         <RotateCcw size={20} className="text-blue-400" />
                        </motion.div>
                      </div>
                    ) : commentsList.length > 0 ? (
                      <div className="space-y-4">
                        {commentsList.map((c, i) => (
                           <div key={c.id || i} className="flex gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0 lowercase overflow-hidden">
                                {c.author ? c.author.charAt(0) : '?'}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-slate-700 truncate">{c.author || '匿名用户'}</span>
                                  {c.likeCount > 0 && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Heart size={10} />{formatNumber(c.likeCount)}</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 leading-snug break-words">
                                  {c.text}
                                </p>
                             </div>
                           </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-4 text-xs text-slate-400">暂无评论数据</div>
                    )}
                 </div>
               </div>
            ) : flipMode === 'comment' && commentAnalysisResult ? (
               <div className="p-4 space-y-6">
                 {/* Comment Summary Card */}
                 <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                   <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                       <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                       热点评论洞察
                     </div>
                     <button 
                       onClick={() => handleCopy(commentAnalysisResult.summary)}
                       className="p-1 hover:bg-blue-50 rounded transition-colors text-slate-300 hover:text-blue-500"
                       title="复制洞察内容"
                     >
                       {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                     </button>
                   </div>
                   <div className="prose prose-sm prose-slate max-w-none">
                     <div className="markdown-body text-[11px] leading-relaxed text-slate-600 font-medium">
                       <Markdown>{String(commentAnalysisResult.summary || '')}</Markdown>
                     </div>
                   </div>
                 </div>
                 
                 {/* Footer Info */}
                 <div className="pt-4 pb-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <MessageCircle size={12} className="text-blue-300" />
                    <span>AI 分析仅供参考，请结合业务实际情况</span>
                 </div>
               </div>
            ) : flipMode === 'insight' && analysisResult ? (
               <div className="p-4 space-y-6">
                 {/* Summary Card */}
                 <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                   <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                       <span className="w-1 h-3 bg-purple-500 rounded-full"></span>
                       热门洞察总结
                     </div>
                     <button 
                       onClick={() => handleCopy(analysisResult.summary)}
                       className="p-1 hover:bg-purple-50 rounded transition-colors text-slate-300 hover:text-purple-500"
                       title="复制总结内容"
                     >
                       {isCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                     </button>
                   </div>
                   <div className="prose prose-sm prose-slate max-w-none">
                     <div className="markdown-body text-[11px] leading-relaxed text-slate-600 font-medium">
                       <Markdown>{String(analysisResult.summary || '')}</Markdown>
                     </div>
                   </div>
                 </div>
                 
                 {/* Structure Timeline */}
                 <div className="px-1">
                   <div className="flex items-center justify-between mb-4">
                     <h4 className="font-bold text-xs flex items-center gap-2 text-slate-800 uppercase tracking-wider">
                       <span className="w-1 h-3 bg-purple-500 rounded-full"></span>
                       脚本结构拆解
                     </h4>
                     <span className="text-[10px] text-slate-400 font-mono italic">
                       共 {analysisResult.structure.length} 个镜头
                     </span>
                   </div>
                   
                   <div className="space-y-4 relative">
                     {/* Vertical Line */}
                     <div className="absolute left-[13px] top-2 bottom-2 w-[1.5px] bg-gradient-to-b from-purple-100 via-slate-100 to-purple-50" />
                     
                     {analysisResult.structure.map((item, idx) => (
                       <div key={idx} className="relative flex items-start gap-4">
                         {/* Circle Indicator */}
                         <div className="relative z-10 flex-shrink-0 w-7 h-7 rounded-full border-2 border-white bg-white shadow-sm flex items-center justify-center transition-transform hover:scale-110">
                            {item.type === 'vo' ? (
                              <div className="w-3 h-3 bg-purple-500 rounded-sm rotate-45" />
                            ) : (
                              <div className="w-2.5 h-2.5 border-2 border-slate-300 rounded-full" />
                            )}
                         </div>

                         {/* Content Card */}
                         <div className="flex-1 min-w-0 bg-white rounded-xl p-3 border border-slate-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:border-purple-200 transition-all group">
                           <div className="flex items-center justify-between gap-2 mb-2">
                             <div className="text-[10px] font-black text-purple-600 bg-purple-50/80 px-2 py-0.5 rounded-md border border-purple-100/50 uppercase tracking-tight">
                               {item.tag}
                             </div>
                             <div className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                               {item.duration.toFixed(1)}s
                             </div>
                           </div>
                           
                           {item.vo && (
                             <div className="mb-2 relative">
                               <div className="absolute -left-1.5 top-0 bottom-0 w-0.5 bg-purple-200 rounded-full opacity-50" />
                               <p className="text-[11px] text-slate-700 leading-normal pl-2.5 italic">
                                 &ldquo;{item.vo}&rdquo;
                               </p>
                             </div>
                           )}
                           
                           <div className="flex items-start gap-1.5 text-[10.5px] text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-dashed border-slate-200">
                             <FileText size={12} className="shrink-0 mt-0.5 opacity-60" />
                             <span className="leading-snug">{item.videoDescription}</span>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
                 
                 {/* Footer Info */}
                 <div className="pt-4 pb-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <Sparkles size={12} className="text-purple-300" />
                    <span>AI 分析仅供参考，请结合业务实际情况</span>
                 </div>
               </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatBadge({ icon, value, onClick }: { icon: React.ReactNode; value: number; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn("flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 transition-colors", onClick ? "cursor-pointer hover:bg-slate-100 active:scale-95" : "hover:bg-slate-100 cursor-default")}
    >
      {icon}
      <span className="text-xs font-bold text-slate-700">{formatNumber(value)}</span>
    </div>
  );
}
