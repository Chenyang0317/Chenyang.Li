import React, { useState, useEffect } from "react";
import { formatNumber, getProxiedAvatar, cn } from "../lib/utils";
import { UnifiedUserProfile, UnifiedVideo } from "../lib/platforms";
import { FileText, ChevronDown, Award, PieChart, Briefcase, Zap } from "lucide-react";
import { ValueInsight } from "./ValueInsight";
import ReactMarkdown from "react-markdown";
import { BloggerValueResult } from "../lib/gemini";

interface UserProfileProps {
  profile: UnifiedUserProfile | null;
  loading: boolean;
  error: string | null;
  videos?: UnifiedVideo[];
}

export function UserProfileView({ profile, loading, error, videos = [] }: UserProfileProps) {
  const [insightReport, setInsightReport] = useState<BloggerValueResult | null>(null);

  // Clear report when profile changes
  useEffect(() => {
    setInsightReport(null);
  }, [profile?.id, profile?.platform]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
        <FileText size={48} className="mb-4 opacity-50" />
        <p>暂无博主数据，请先在首页进行搜索</p>
      </div>
    );
  }

  const user = profile;
  const isTopic = user.nickname?.startsWith("#");

  if (isTopic) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full text-center">
        <h1 className="text-6xl font-black text-slate-900 tracking-tight mb-2">
          {user.nickname}
        </h1>
        <div className="h-1 w-24 bg-blue-600 mx-auto rounded-full mt-4"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
          <span className="text-blue-600 text-3xl">✨</span> 博主多维数据雷达与价值洞察
        </h2>
        <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
          <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded border border-slate-200">
            <FileText size={14} />
            数据来源: {user.platform} | Local Storage DB
          </span>
          {user.platform !== "小红书" && (
            <span>
              当前共收录{" "}
              <strong className="text-blue-600 mx-1">{user.videoCount}</strong>{" "}
              条有效数据
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col md:flex-row items-center md:items-stretch gap-12">
        {/* Avatar */}
        <div className="relative w-40 h-40 shrink-0 mb-6 md:mb-0">
          <div className="absolute inset-0 bg-blue-50 rounded-full scale-105 shadow-inner" />
          <img
            src={getProxiedAvatar(user.avatar, user.nickname)}
            alt={user.nickname}
            className="relative w-full h-full rounded-full object-cover border-4 border-white shadow-xl z-20"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes("ui-avatars.com")) {
                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nickname)}&background=random&color=fff`;
              }
            }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 w-full bg-slate-50/50 rounded-2xl p-6 border border-slate-50 flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-3xl font-bold text-slate-900">{user.nickname}</h1>
            {user.ipLocation && (
              <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded text-center">
                IP属地: {user.ipLocation}
              </span>
            )}
          </div>

          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-2xl bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            {user.signature || "该用户很懒，还没有填写简介。"}
          </p>

          <div className="flex items-center gap-12">
            <div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {user.followerCount ? user.followerCount.toLocaleString() : "0"}
              </div>
              <div className="text-xs font-medium text-slate-400">粉丝总数</div>
            </div>
            <div className="w-[1px] h-10 bg-slate-200"></div>
            <div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {user.likeCount ? user.likeCount.toLocaleString() : "0"}
              </div>
              <div className="text-xs font-medium text-slate-400">累积获赞</div>
            </div>
            {user.platform !== "小红书" && (
              <>
                <div className="w-[1px] h-10 bg-slate-200"></div>
                <div>
                  <div className="text-2xl font-black text-slate-900 mb-1">
                    {user.videoCount ? user.videoCount.toLocaleString() : "0"}
                  </div>
                  <div className="text-xs font-medium text-slate-400">作品总量</div>
                </div>
              </>
            )}
          </div>

          {/* Tags area */}
          <div className="flex flex-wrap gap-2 mt-6">
            <span className="px-3 py-1 bg-white text-slate-500 text-[10px] font-bold rounded-full border border-slate-200 uppercase tracking-wider">
              {user.platform}全量收录
            </span>
          </div>
        </div>
        
        <ValueInsight profile={user} videos={videos} onReport={setInsightReport} hasReport={!!insightReport} />
      </div>

      {insightReport && (
        <div id="insight-report-section" className="mt-8 bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-[100px] mix-blend-multiply opacity-50 pointer-events-none"></div>
          
          <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between z-10 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-indigo-600">
                <Briefcase size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">商业价值全景审计报告</h3>
                <p className="text-sm text-slate-500 mt-1">AI 驱动驱动的博主潜能与品牌适配度分析</p>
              </div>
            </div>
            
            <div className="mt-4 md:mt-0 flex items-center gap-6">
              <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                 <Zap size={16} className="text-indigo-600" />
                 <span className="text-xs font-bold text-indigo-800">VideoTrend AI Engine</span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-indigo-600 leading-none">{insightReport.score}<span className="text-sm text-slate-400 font-normal ml-1">/100</span></div>
                <div className="text-xs text-slate-500 font-medium">综合商业评分</div>
              </div>
            </div>
          </div>

          <div className="px-10 py-6 bg-indigo-900 border-b border-indigo-950 flex flex-col md:flex-row gap-6 justify-between items-center z-10 relative shadow-inner">
             <div className="flex items-center gap-6 w-full justify-between overflow-x-auto text-sm">
                <div className="flex flex-col gap-1 items-center md:items-start shrink-0">
                  <span className="text-indigo-200 font-medium tracking-wide">内容原创力</span>
                  <div className="flex text-yellow-400 tracking-widest text-xl drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
                    {"★".repeat(insightReport.dimensions.originality)}{"☆".repeat(5 - insightReport.dimensions.originality)}
                  </div>
                </div>
                <div className="hidden md:block w-px h-8 bg-indigo-700/50 shrink-0"></div>
                <div className="flex flex-col gap-1 items-center md:items-start shrink-0">
                  <span className="text-indigo-200 font-medium tracking-wide">粉丝购买力</span>
                  <div className="flex text-yellow-400 tracking-widest text-xl drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
                    {"★".repeat(insightReport.dimensions.purchasingPower)}{"☆".repeat(5 - insightReport.dimensions.purchasingPower)}
                  </div>
                </div>
                <div className="hidden md:block w-px h-8 bg-indigo-700/50 shrink-0"></div>
                <div className="flex flex-col gap-1 items-center md:items-start shrink-0">
                  <span className="text-indigo-200 font-medium tracking-wide">品牌适配度</span>
                  <div className="flex text-yellow-400 tracking-widest text-xl drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
                    {"★".repeat(insightReport.dimensions.brandFit)}{"☆".repeat(5 - insightReport.dimensions.brandFit)}
                  </div>
                </div>
                <div className="hidden md:block w-px h-8 bg-indigo-700/50 shrink-0"></div>
                <div className="flex flex-col gap-1 items-center md:items-start shrink-0">
                  <span className="text-indigo-200 font-medium tracking-wide">增长潜力</span>
                  <div className="flex text-yellow-400 tracking-widest text-xl drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
                    {"★".repeat(insightReport.dimensions.growth)}{"☆".repeat(5 - insightReport.dimensions.growth)}
                  </div>
                </div>
             </div>
          </div>
          
          <div className="p-10 z-10 relative markdown-body prose prose-slate max-w-none prose-headings:text-indigo-950 prose-headings:font-bold prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:flex prose-h3:items-center prose-h3:gap-2 prose-h3:before:content-[''] prose-h3:before:block prose-h3:before:w-1.5 prose-h3:before:h-6 prose-h3:before:bg-indigo-500 prose-h3:before:rounded-full prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600">
            <ReactMarkdown>{insightReport.report}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
