import React, { useEffect, useState } from 'react';
import { UnifiedUserProfile, fetchUserProfile, fetchUserVideos, PlatformType } from '../lib/platforms';
import { storage } from '../lib/storage';
import { Hash, Search, X, Loader2 } from 'lucide-react';
import { formatNumber, cn, getProxiedAvatar } from '../lib/utils';
import { useAuth } from './AuthProvider';

interface TopicManagementViewProps {
  onTopicClick: (platform: string, id: string, mode: 'view' | 'update') => void;
}

export function TopicManagementView({ onTopicClick }: TopicManagementViewProps) {
  const { user } = useAuth();
  const [topics, setTopics] = useState<UnifiedUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('全部');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const platformsFilter = ['全部', '抖音', 'B站', '小红书', '微博'];

  useEffect(() => {
    loadTopics();
  }, [user]);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const list = await storage.get<UnifiedUserProfile[]>('saved_topics') || [];
      if (Array.isArray(list)) {
        setTopics(list);
      } else {
        setTopics([]);
      }
    } catch (e) {
      console.error("Failed to load topics:", e);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, platform: string, id: string) => {
    e.stopPropagation();
    const newList = topics.filter(t => !(t.platform === platform && t.id === id));
    await storage.set('saved_topics', newList);
    setTopics(newList);
  };

  const handleUpdate = async (e: React.MouseEvent, platform: string, id: string) => {
    e.stopPropagation();
    if (updatingId) return;
    
    setUpdatingId(`${platform}-${id}`);
    try {
        const mode = 'topic';
        const profileData = await fetchUserProfile(platform as PlatformType, id, mode);
        const listKey = 'saved_topics';
        let savedList = await storage.get<UnifiedUserProfile[]>(listKey) || [];
        const existingIdx = savedList.findIndex(t => t.platform === profileData.platform && t.id === profileData.id);
        
        if (existingIdx >= 0) {
            if (savedList[existingIdx].isHotTopic) {
                profileData.isHotTopic = true;
            }
            savedList[existingIdx] = profileData;
        } else {
            savedList.push(profileData);
        }
        await storage.set(listKey, savedList);
        setTopics(savedList);
        
        const videoRes = await fetchUserVideos(platform as PlatformType, profileData.id, 0, 0, mode, 0);
        await storage.set(`saved_videos_${platform}_${profileData.id}`, videoRes.videos);
        
    } catch (err: any) {
        alert(`更新失败: ${err.message}`);
    } finally {
        setUpdatingId(null);
    }
  };

  const filteredTopics = activeFilter === '全部' 
    ? topics 
    : topics.filter(t => t.platform === activeFilter);

  if (loading) {
    return <div className="flex-1 flex justify-center items-center font-sans mt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>
  }

  return (
    <div className="flex-1 p-8 md:p-12 lg:p-16 max-w-7xl mx-auto w-full font-sans animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-start gap-5 mb-10">
        <div className="bg-purple-600/10 p-3.5 rounded-2xl shadow-sm text-purple-600">
          <Hash size={32} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            话题信息库
          </h1>
          <p className="text-slate-500 mt-2 font-medium text-lg leading-relaxed">在这里管理和查看您之前抓取过的话题数据记录与视频信息。</p>
        </div>
      </div>

      {/* platform Filter */}
      <div className="grid grid-cols-4 gap-1 md:gap-2 mb-10 w-full">
        {platformsFilter.map(p => (
          <button
            key={p}
            onClick={() => setActiveFilter(p)}
            className={cn(
              "px-0.5 py-1.5 rounded-lg text-[9px] md:text-[11px] font-black transition-all border text-center truncate",
              activeFilter === p 
                ? "bg-purple-600 text-white border-purple-600 shadow-md active:scale-95" 
                : "bg-white text-slate-500 border-slate-100 hover:border-slate-300 shadow-sm active:scale-95 hover:bg-slate-50"
            )}
            title={p}
          >
            {p}
          </button>
        ))}
      </div>

      {filteredTopics.length === 0 ? (
        <div className="text-slate-400 text-center py-32 bg-white border border-dashed border-slate-200 rounded-[48px] shadow-sm">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={32} strokeWidth={2} className="opacity-40" />
          </div>
          <p className="text-2xl font-bold text-slate-700">没有找到相关的话题记录</p>
          <p className="text-slate-400 mt-2 font-medium">您可以尝试查看其他平台或者抓取新的话题数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 md:gap-4 lg:gap-6">
          {filteredTopics.map(topic => {
            const proxiedAvatar = getProxiedAvatar(topic.avatar, topic.nickname);

            return (
              <div 
                key={`${topic.platform}-${topic.id}`}
                className="bg-white rounded-xl md:rounded-2xl p-2 md:p-4 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group overflow-hidden flex flex-col h-full"
              >
                {/* Delete Button */}
                <button
                  onClick={(e) => handleDelete(e, topic.platform, topic.id)}
                  className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors z-20 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 outline-none"
                  title="删除"
                >
                  <X size={14} strokeWidth={3} />
                </button>

                {/* Card Header: Avatar & Nickname */}
                <div className="flex flex-col items-center gap-1.5 md:gap-3 text-center mb-auto">
                  <div className="relative">
                    <img 
                      src={proxiedAvatar} 
                      alt={topic.nickname} 
                      className="w-10 h-10 md:w-16 md:h-16 rounded-full object-cover shadow-sm bg-slate-50 transition-transform duration-500 group-hover:scale-110" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('ui-avatars.com')) {
                          target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.nickname)}&background=random`;
                        }
                      }}
                    />
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-4 h-4 md:w-6 md:h-6 rounded-full border-2 border-white flex items-center justify-center text-[6px] md:text-[7px] font-black text-white shadow-sm z-10",
                      topic.platform === '抖音' ? 'bg-black' :
                      topic.platform === 'B站' ? 'bg-[#FF6699]' :
                      topic.platform === '小红书' ? 'bg-[#FF2442]' :
                      topic.platform === '微博' ? 'bg-orange-500' : 'bg-purple-500'
                    )}>
                      {topic.platform.charAt(0)}
                    </div>
                  </div>
                  <div className="min-w-0 w-full">
                    <h3 className={cn("text-[10px] md:text-sm font-black truncate transition-colors flex items-center justify-center gap-1", topic.isHotTopic ? "text-red-500 group-hover:text-red-600" : "text-slate-900 group-hover:text-purple-600")}>
                      {topic.isHotTopic && <span className="text-red-500 font-bold" title="热门话题">🔥</span>}
                      <span className="truncate">{topic.nickname || '未知话题'}</span>
                    </h3>
                  </div>
                </div>

                {/* Stats Bench */}
                <div className="grid mt-2 md:mt-4 p-1.5 md:p-2 bg-slate-50/50 rounded-lg md:rounded-xl border border-slate-100 gap-0.5 md:gap-1 text-center shrink-0 grid-cols-2">
                  <div className="min-w-0">
                    <div className="text-[9px] md:text-[11px] font-black text-purple-600 truncate">{formatNumber(topic.followerCount)}</div>
                    <div className="text-[6px] md:text-[7px] font-bold text-slate-400 truncate uppercase">播放量</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] md:text-[11px] font-black text-slate-900 truncate">{topic.videoCount || '-'}</div>
                    <div className="text-[6px] md:text-[7px] font-bold text-slate-400 truncate uppercase">作品</div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="grid grid-cols-2 gap-1 md:gap-2 mt-2 md:mt-4 shrink-0">
                  <button 
                    onClick={() => onTopicClick(topic.platform, topic.id, 'view')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black transition-all active:scale-95"
                  >
                    查看
                  </button>
                  <button 
                    onClick={(e) => handleUpdate(e, topic.platform, topic.id)}
                    disabled={updatingId === `${topic.platform}-${topic.id}`}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-600 py-1 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-black transition-all active:scale-95 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingId === `${topic.platform}-${topic.id}` ? (
                       <>
                         <Loader2 size={12} className="animate-spin" />
                         更新中
                       </>
                    ) : '更新'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
