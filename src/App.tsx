import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Header, ApiKeyModal } from './components/Layout';
import { UsageModal } from './components/UsageModal';
import { HomeView } from './components/Home';
import { UserProfileView } from './components/UserProfile';
import { VideoListView } from './components/VideoList';
import { GlobalMonitorJob } from './components/GlobalMonitorJob';
import { 
  UnifiedVideo, 
  UnifiedUserProfile, 
  fetchUserProfile, 
  fetchUserVideos,
  PlatformType
} from './lib/platforms';

import { ManagementView } from './components/Management';
import { TopicManagementView } from './components/TopicManagement';
import { DataAnalysis } from './components/DataAnalysis';
import { SimulateView } from './components/SimulateView';
import { storage } from './lib/storage';

type Tab = 'home' | 'profile_search' | 'management' | 'topics' | 'simulate';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);

  // States
  const [currentId, setCurrentId] = useState<string>('');
  const [currentPlatform, setCurrentPlatform] = useState<PlatformType>('抖音');
  const [profile, setProfile] = useState<UnifiedUserProfile | null>(null);
  const [videos, setVideos] = useState<UnifiedVideo[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // Simulate view state
  const [simulateSelectMode, setSimulateSelectMode] = useState(false);
  const [selectedSimulateMatrix, setSelectedSimulateMatrix] = useState<{ matrixName: string, members: UnifiedUserProfile[] } | null>(null);

  useEffect(() => {
    storage.get<{ matrixName: string, members: UnifiedUserProfile[] }>('selected_simulate_matrix').then(m => {
      if (m) setSelectedSimulateMatrix(m);
    });
  }, []);

  useEffect(() => {
    if (selectedSimulateMatrix) {
      storage.set('selected_simulate_matrix', selectedSimulateMatrix);
    } else {
      storage.delete('selected_simulate_matrix');
    }
  }, [selectedSimulateMatrix]);
  
  // Loading & Error States
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);
  
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [errorVideos, setErrorVideos] = useState<string | null>(null);
  
  // Video list controls
  const [sortType, setSortType] = useState<number>(0);
  const [publishTime, setPublishTime] = useState<number>(0);

  const handleLibraryClick = async (platform: string, id: string, action: 'view' | 'update', mode: 'user' | 'topic') => {
    setCurrentId(id);
    setCurrentPlatform(platform as PlatformType);
    
    if (action === 'view') {
      setIsDetailView(true);
      // Let activeTab remain as it is (management or topics)
    } else {
      setActiveTab('profile_search');
      setIsDetailView(false);
    }
    
    // Automatically show analysis chart when coming from management list (clicking "View")
    setShowAnalysis(action === 'view');
    
    const listKey = mode === 'topic' ? 'saved_topics' : 'saved_bloggers';
    
    if (action === 'view') {
      setLoadingProfile(true);
      setLoadingVideos(true);
      try {
        const savedList = await storage.get<UnifiedUserProfile[]>(listKey) || [];
        const cachedProfile = savedList.find(b => b.platform === platform && b.id === id);
        if (cachedProfile) {
          setProfile(cachedProfile);
        }
        const cachedVideos = await storage.get<UnifiedVideo[]>(`saved_videos_${platform}_${id}`) || [];
        setVideos(cachedVideos);
      } finally {
        setLoadingProfile(false);
        setLoadingVideos(false);
      }
    } else {
      handleSearch(id, mode, platform, true);
    }
  };

  const handleSearch = async (queryOrId: string, mode: 'user' | 'topic', platform: string, isDirectId = false) => {
    if (platform !== '抖音' && platform !== 'B站' && platform !== '小红书' && platform !== '微博') {
      alert(`抱歉，目前仅支持抖音、B站、小红书和微博平台数据抓取测试。`);
      return;
    }
    if (mode === 'topic' && platform !== '抖音' && platform !== 'B站' && platform !== '微博' && platform !== '小红书') {
      alert('抱歉，目前仅支持抖音、B站、小红书和微博平台的话题搜索模式。');
      return;
    }

    let parsedId = queryOrId;
    if (isDirectId) {
      if (platform !== '小红书' && platform !== '微博') {
        parsedId = queryOrId.replace(/https?:\/\/[^\s]+/, '').trim() || queryOrId;
      }
    }

    if (!parsedId) {
      alert('请输入有效的博主链接或ID。');
      return;
    }

    setCurrentId(parsedId);
    setCurrentPlatform(platform as PlatformType);
    setProfile(null);
    setVideos([]);
    setShowAnalysis(false);
    
    // Automatically switch to profile_search tab after search to show loading
    setActiveTab('profile_search');
    setIsDetailView(false);

    // Fetch Profile
    setLoadingProfile(true);
    setErrorProfile(null);
    try {
      const profileData = await fetchUserProfile(platform as PlatformType, parsedId, mode);
      setProfile(profileData);
      
      // Save to local storage for management
      const listKey = mode === 'topic' ? 'saved_topics' : 'saved_bloggers';
      const savedList = await storage.get<UnifiedUserProfile[]>(listKey) || [];
      const existingIdx = savedList.findIndex(b => b.platform === profileData.platform && b.id === profileData.id);
      
      if (existingIdx >= 0) {
         savedList[existingIdx] = profileData;
      } else {
         savedList.push(profileData);
      }
      await storage.set(listKey, savedList);

    } catch (err: any) {
      setErrorProfile(err.message);
      if (err.message.includes('API Key')) {
        setIsApiKeyModalOpen(true);
      }
    } finally {
      setLoadingProfile(false);
    }

    // Fetch initial videos
    await fetchVideos(platform as PlatformType, parsedId, 0, sortType, false, mode, publishTime);
  };

  const fetchVideos = async (platform: PlatformType, id: string, cursor: number, sort: number, append: boolean = false, currentMode: 'user' | 'topic' = 'user', timeFilter: number = 0) => {
    setLoadingVideos(true);
    setErrorVideos(null);
    try {
      // Fetch latest from API, we will sort it locally on the frontend
      const res = await fetchUserVideos(platform, id, cursor, sort, currentMode, timeFilter); 
      
      // Limit to 30 videos max as per requirements
      let newVideos = append ? [...videos, ...res.videos] : res.videos;
      if (newVideos.length > 30) {
        newVideos = newVideos.slice(0, 30);
      }
      
      // Initial correct sort
      if (platform !== 'B站') {
        newVideos.sort((a, b) => {
          if (sort === 1) return b.stats.likeCount - a.stats.likeCount;
          return b.createTime - a.createTime;
        });
      }

      const isTopic = profile?.nickname?.startsWith('#') || profile?.signature === 'B站话题搜索结果';
      if (platform === 'B站' && newVideos.length > 0 && !isTopic) {
        setProfile(prev => {
          if (prev && !prev.nickname?.startsWith('#')) {
            const updatedProfile = { 
              ...prev, 
              nickname: newVideos[0].author.nickname || prev.nickname, 
              avatar: newVideos[0].author.avatar || prev.avatar 
            };
            
            // Async save to storage without blocking
            storage.get<UnifiedUserProfile[]>('saved_bloggers').then(list => {
               const savedList = list || [];
               const idx = savedList.findIndex(b => b.platform === 'B站' && b.id === id);
               if (idx >= 0) savedList[idx] = updatedProfile;
               storage.set('saved_bloggers', savedList);
            });
            
            return updatedProfile;
          }
          return prev;
        });
      }

      setVideos(newVideos);
      await storage.set(`saved_videos_${platform}_${id}`, newVideos);

    } catch (err: any) {
      setErrorVideos(err.message);
    } finally {
      setLoadingVideos(false);
    }
  };

  // Handle sort change by sorting local state (ensures immediate UI update and accurate data points)
  const handleSortChange = async (newSort: number) => {
    if (newSort === sortType) return;
    setSortType(newSort);

    setVideos(prev => {
       const sorted = [...prev].sort((a, b) => {
          if (newSort === 1) {
            // B站 uses playCount for sortType 1, others use likeCount
            if (currentPlatform === 'B站' && a.stats.playCount !== undefined && b.stats.playCount !== undefined) {
              return b.stats.playCount - a.stats.playCount;
            }
            return b.stats.likeCount - a.stats.likeCount;
          }
          if (newSort === 2) return b.stats.collectCount - a.stats.collectCount;
          return b.createTime - a.createTime;
       });
       return sorted;
    });
  };


  const handlePublishTimeChange = async (newTime: number) => {
    if (newTime === publishTime) return;
    setPublishTime(newTime);
    setVideos([]);
    await fetchVideos(currentPlatform, currentId, 0, sortType, false, profile?.nickname?.startsWith('#') ? 'topic' : 'user', newTime);
  };

  const renderDetailView = () => (
    <div className="flex flex-col py-8 pb-32">
      {(activeTab === 'management' || activeTab === 'topics') && (
         <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-4">
           <button 
             onClick={() => setIsDetailView(false)} 
             className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 font-medium bg-white/50 px-4 py-2 rounded-full shadow-sm w-fit"
           >
             <ChevronLeft size={18} /> 
             返回列表
           </button>
         </div>
      )}
      <UserProfileView 
        profile={profile} 
        loading={loadingProfile} 
        error={errorProfile}
        videos={videos}
      />
      {(!loadingProfile || videos.length > 0) && profile && (
        <>
          {showAnalysis && <DataAnalysis videos={videos} />}
          <div className="mt-8">
            <VideoListView 
              videos={videos} 
              loading={loadingVideos} 
              error={errorVideos}
              currentSort={sortType}
              onSortChange={handleSortChange}
              onAuthorClick={(platform, authorId) => {
                if (activeTab === 'management' || isDetailView) {
                   handleLibraryClick(platform, authorId, 'view', 'user');
                } else {
                   handleSearch(authorId, 'user', platform as PlatformType, true);
                }
              }}
              publishTime={publishTime}
              onPublishTimeChange={handlePublishTimeChange}
              platform={currentPlatform}
              isAnalysisMode={showAnalysis}
              profile={profile}
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header 
        activeTab={activeTab} 
        setActiveTab={(tab: Tab) => {
          setActiveTab(tab);
          setIsDetailView(false);
          if (tab !== 'management') setSimulateSelectMode(false);
        }} 
        onSettingsClick={() => setIsApiKeyModalOpen(true)}
        onUsageClick={() => setIsUsageModalOpen(true)}
      />
      
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#F8FAFC]">
        {activeTab === 'home' && <HomeView onSearch={handleSearch} />}
        {activeTab === 'profile_search' && renderDetailView()}
        {activeTab === 'management' && (
           isDetailView ? renderDetailView() : (
             <ManagementView 
               selectMode={simulateSelectMode}
               onMatrixSelect={(matrixName, members) => {
                  if (simulateSelectMode) {
                     setSelectedSimulateMatrix({ matrixName, members });
                     setSimulateSelectMode(false);
                     setActiveTab('simulate');
                  }
               }}
               onBloggerClick={(platform, id, action, profileInfo) => {
                  handleLibraryClick(platform, id, action, 'user');
               }} 
             />
           )
        )}
        {activeTab === 'topics' && (
           isDetailView ? renderDetailView() : (
             <TopicManagementView onTopicClick={(platform, id, action) => {
                handleLibraryClick(platform, id, action, 'topic');
             }} />
           )
        )}
        {activeTab === 'simulate' && (
          <SimulateView 
            selectedMatrix={selectedSimulateMatrix}
            onSelectMatrix={() => {
              setSimulateSelectMode(true);
              setActiveTab('management');
            }}
          />
        )}
      </main>

      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)} 
      />
      <UsageModal 
        isOpen={isUsageModalOpen} 
        onClose={() => setIsUsageModalOpen(false)} 
      />
      <GlobalMonitorJob />
    </div>
  );
}
