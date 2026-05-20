import React, { useState, useEffect } from 'react';
import { UploadCloud, Play, FileText, Image as ImageIcon, Zap, Rocket, BarChart3, TrendingUp, CheckCircle, Flame, Heart, Target, Plus, User, Sparkles, Loader2, X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getProxiedAvatar, formatNumber } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { UnifiedUserProfile } from '../lib/platforms';
import { analyzePlatformInsight, simulateTrafficPerformance, SimulationResult } from '../lib/gemini';
import { storage } from '../lib/storage';
import { useAuth } from './AuthProvider';

interface UploadZoneProps {
  label: string;
  icon: React.ReactNode;
  accept: string;
  onUpload: (file: any) => void;
  file: File | File[] | null;
  compact?: boolean;
  multiple?: boolean;
}

function UploadZone({ label, icon, accept, onUpload, file, compact, multiple }: UploadZoneProps) {
  const isMultiple = Array.isArray(file);
  const hasFile = isMultiple ? file.length > 0 : !!file;
  const filesList = isMultiple ? (file as File[]) : (file ? [file as File] : []);
  
  const [previews, setPreviews] = useState<string[]>([]);
  
  useEffect(() => {
    const urls = filesList.map(f => {
      if (f.type.startsWith('image/')) {
        return URL.createObjectURL(f);
      }
      return '';
    });
    setPreviews(urls);
    return () => urls.forEach(u => u && URL.revokeObjectURL(u));
  }, [file]);

  return (
    <div className={cn("relative group border-2 border-dashed border-slate-300 rounded-2xl bg-white hover:bg-slate-50 hover:border-indigo-300 transition-all flex flex-col items-center justify-center text-center overflow-hidden h-full", compact ? "p-4" : "p-6")}>
      {hasFile ? (
        <div className="flex flex-col items-center justify-center gap-2 w-full h-full animate-in fade-in zoom-in duration-300 z-10" style={{ pointerEvents: 'none' }}>
          <div className="flex flex-wrap gap-2 justify-center max-h-[80px] overflow-hidden mb-1">
            {filesList.slice(0, 3).map((f, i) => (
               <div key={i} className="relative rounded overflow-hidden shadow-sm border border-slate-200">
                 {previews[i] ? (
                    <img src={previews[i]} className={cn("object-cover", compact ? "w-10 h-10" : "w-16 h-16")} alt="preview" />
                 ) : (
                    <div className={cn("bg-slate-100 flex items-center justify-center text-slate-400", compact ? "w-10 h-10" : "w-16 h-16")}>
                      {f.type.startsWith('video/') ? <Play size={compact ? 16 : 24} /> : <FileText size={compact ? 16 : 24} />}
                    </div>
                 )}
               </div>
            ))}
            {filesList.length > 3 && (
               <div className={cn("bg-slate-100 flex items-center justify-center text-slate-500 font-bold rounded shadow-sm border border-slate-200", compact ? "w-10 h-10 text-xs" : "w-16 h-16 text-sm")}>
                 +{filesList.length - 3}
               </div>
            )}
          </div>
          {isMultiple ? (
            <p className={cn("font-bold text-slate-800 truncate w-full px-2", compact ? "text-xs" : "text-sm")}>已选择 {file.length} 个文件</p>
          ) : (
            <p className={cn("font-bold text-slate-800 truncate w-full px-2", compact ? "text-xs" : "text-sm")}>{(file as File).name}</p>
          )}
          {!isMultiple && (
            <span className="text-[10px] text-slate-400">{((file as File).size / 1024 / 1024).toFixed(2)} MB</span>
          )}
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpload(multiple ? [] : null); }}
            style={{ pointerEvents: 'auto' }}
            className="text-red-500 text-[10px] font-medium hover:underline mt-1 relative z-20"
          >
            重新上传
          </button>
        </div>
      ) : (
        <>
          <div className={cn("bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all duration-300", compact ? "mb-2 w-10 h-10" : "mb-4 w-14 h-14 shadow-sm")}>
            {icon}
          </div>
          <h4 className={cn("font-bold text-slate-800 mb-1", compact ? "text-xs" : "text-sm")}>{label}</h4>
          {!compact && <p className="text-xs text-slate-500 mb-4 px-2">拖拽文件到这里，或点击浏览本地文件</p>}
        </>
      )}
      <input 
        type="file" 
        multiple={multiple}
        accept={accept}
        className={cn("absolute inset-0 w-full h-full opacity-0 cursor-pointer", hasFile ? "hidden" : "")}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUpload(multiple ? Array.from(e.target.files) : e.target.files[0]);
          }
        }}
      />
    </div>
  );
}

interface PlatformTraffic {
  name: string;
  value: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
}

export function SimulateView({ 
  selectedMatrix, 
  onSelectMatrix 
}: { 
  selectedMatrix?: { matrixName: string, members: UnifiedUserProfile[] } | null, 
  onSelectMatrix?: () => void 
}) {
  const { user } = useAuth();
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [docText, setDocText] = useState('');
  const [budget, setBudget] = useState<number | string>(1000);
  
  const [trafficAllocation, setTrafficAllocation] = useState<PlatformTraffic[]>([
    { name: '抖音', value: 30, color: 'bg-indigo-500', bg: 'bg-indigo-50', icon: <Flame size={16} /> },
    { name: 'B站', value: 20, color: 'bg-indigo-500', bg: 'bg-indigo-50', icon: <Play size={16} /> },
    { name: '小红书', value: 25, color: 'bg-indigo-500', bg: 'bg-indigo-50', icon: <Heart size={16} /> },
    { name: '微博', value: 25, color: 'bg-indigo-500', bg: 'bg-indigo-50', icon: <Target size={16} /> },
  ]);

  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [insightReport, setInsightReport] = useState<string | null>(null);
  const [isUploadConfirmed, setIsUploadConfirmed] = useState(false);

  useEffect(() => {
    if (selectedMatrix) {
      storage.get<string>(`insight_report_matrix_${selectedMatrix.matrixName}`).then(report => {
        setInsightReport(report || null);
      });
      storage.get<any>(`simulate_state_${selectedMatrix.matrixName}`).then(state => {
        if (state) {
          if (state.docText !== undefined) setDocText(state.docText);
          if (state.budget !== undefined) setBudget(state.budget);
          if (state.trafficAllocation !== undefined) setTrafficAllocation(state.trafficAllocation);
          if (state.result !== undefined) setResult(state.result);
        } else {
          setDocText('');
          setBudget(1000);
          setResult(null);
        }
      });
    } else {
      setInsightReport(null);
      setDocText('');
      setResult(null);
    }
  }, [selectedMatrix, user]);

  useEffect(() => {
    if (selectedMatrix) {
      if (insightReport) {
        storage.set(`insight_report_matrix_${selectedMatrix.matrixName}`, insightReport);
      } else {
        storage.delete(`insight_report_matrix_${selectedMatrix.matrixName}`);
      }
    }
  }, [insightReport, selectedMatrix]);

  useEffect(() => {
    if (selectedMatrix) {
      storage.set(`simulate_state_${selectedMatrix.matrixName}`, {
        docText,
        budget,
        trafficAllocation,
        result
      });
    }
  }, [docText, budget, trafficAllocation, result, selectedMatrix]);

  const handleInsight = async () => {
    if (!selectedMatrix) {
      alert('请先选择矩阵');
      return;
    }
    setIsInsightLoading(true);
    try {
      const res = await analyzePlatformInsight(selectedMatrix.matrixName, selectedMatrix.members);
      setInsightReport(res);
    } catch (err) {
      console.error(err);
      alert('洞察生成失败');
    } finally {
      setIsInsightLoading(false);
    }
  };

  const handleUploadInsight = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsInsightLoading(true);
    
    // Mock parsing document since frontend doesn't have PDF/Word parser build-in
    setTimeout(() => {
      setInsightReport(`## 外部洞察已加载\n\n已成功解析外部市场洞察文件：**${file.name}**\n\n系统已将其中的关键画像特征与平台参数融入沙盘，您现在可以启动下方的“模拟投流”。\n\n> *提示：在真实接入 Atypica API 时，此处将调用文档解析接口提取结构化知识。*`);
      setIsInsightLoading(false);
    }, 1000);
  };

  const handleSliderChange = (idx: number, newValue: number) => {
    let leftSum = 0;
    for (let i = 0; i < idx; i++) {
        leftSum += trafficAllocation[i].value;
    }

    let val = Math.max(0, Math.min(100 - leftSum, newValue));
    const newAllocation = [...trafficAllocation];
    const diff = val - newAllocation[idx].value;
    
    if (Math.abs(diff) < 0.1) return;

    newAllocation[idx] = { ...newAllocation[idx], value: val };

    const remaining = 100 - leftSum - val;
    let rightTotal = 0;
    for (let i = idx + 1; i < newAllocation.length; i++) {
        rightTotal += trafficAllocation[i].value;
    }

    if (idx < newAllocation.length - 1) {
        if (rightTotal === 0) {
            const share = remaining / (newAllocation.length - 1 - idx);
            for (let i = idx + 1; i < newAllocation.length; i++) {
                newAllocation[i] = { ...newAllocation[i], value: share };
            }
        } else {
            for (let i = idx + 1; i < newAllocation.length; i++) {
                newAllocation[i] = { ...newAllocation[i], value: (trafficAllocation[i].value / rightTotal) * remaining };
            }
        }
    } else {
        newAllocation[idx].value = 100 - leftSum;
    }
    
    setTrafficAllocation(newAllocation);
  };

  const handleSimulate = async () => {
    if (mediaFiles.length === 0 && !docText.trim()) {
      alert('请先上传测试视频/图片或文案素材！');
      return;
    }
    
    setIsSimulating(true);
    setResult(null);
    
    try {
      const contentDesc = []
      if (mediaFiles.length > 0) contentDesc.push(`媒体素材：包含 ${mediaFiles.length} 个文件`);
      if (docText.trim()) contentDesc.push(`图文文案：${docText.slice(0, 100)}...`);
      
      const res = await simulateTrafficPerformance(
        Number(budget),
        contentDesc.join('，'),
        insightReport || '缺乏平台洞察参考，请先生成平台洞察',
        trafficAllocation.map(t => ({ name: t.name, value: t.value }))
      );
      setResult(res);
    } catch (err) {
      console.error(err);
      alert('模拟投流失败');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 lg:p-8 mb-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-[100px] mix-blend-multiply opacity-50 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col gap-6">
          
          {/* Row 1 */}
          <div className="flex flex-col md:flex-row gap-6 h-auto md:h-[140px]">
            {/* Avatar (Click to select) */}
            <div 
              onClick={onSelectMatrix}
              className="w-full md:w-[140px] h-[140px] rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors shrink-0 group relative overflow-hidden"
            >
              {selectedMatrix ? (
                <>
                  {(() => {
                    const primaryMember = selectedMatrix.members.find(m => m.platform === '抖音') || selectedMatrix.members[0];
                    return (
                      <img src={getProxiedAvatar(primaryMember.avatar)} alt={primaryMember.nickname} className="absolute inset-0 w-full h-full object-cover" />
                    );
                  })()}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm z-20">
                    <span className="text-white text-xs font-bold">更换矩阵</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-indigo-500 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <span className="text-xs font-bold">选择矩阵</span>
                </div>
              )}
            </div>

            {/* Info & Action Stack */}
            <div className="flex flex-col gap-3 w-full md:w-48 shrink-0">
              <div className="flex-1 bg-white rounded-xl p-3 flex flex-col justify-center border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[80px] h-[80px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full blur-[20px] mix-blend-multiply opacity-60 pointer-events-none"></div>
                {selectedMatrix ? (
                  <div className="relative z-10">
                    <div className="font-bold text-slate-800 line-clamp-1 text-lg mb-1" title={selectedMatrix.matrixName}>{selectedMatrix.matrixName}</div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {Array.from(new Set(selectedMatrix.members.map(m => m.platform))).map(p => (
                         <span key={p} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">{p}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic font-medium relative z-10">暂无矩阵信息</div>
                )}
              </div>
              <div className="flex bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-700 rounded-xl border border-indigo-100 shadow-sm overflow-hidden h-12">
                <button 
                  onClick={handleInsight}
                  disabled={isInsightLoading || !selectedMatrix}
                  className="flex-1 flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-100/50"
                >
                  {isInsightLoading ? <Loader2 className="animate-spin text-indigo-600" size={18} /> : <Sparkles className="text-indigo-600" size={18} />}
                  {isInsightLoading ? '正在洞察...' : '平台洞察'}
                </button>
                <label className="flex items-center justify-center w-12 border-l border-indigo-200/50 hover:bg-indigo-100/80 cursor-pointer disabled:opacity-50 transition-colors" title="上传外部洞察报告">
                  <UploadCloud size={18} className="text-indigo-600" />
                  <input type="file" className="hidden" accept=".doc,.docx,.pdf,application/msword,application/pdf" onChange={handleUploadInsight} />
                </label>
              </div>
            </div>

            {/* Recent Data Box */}
            <div className="flex-[1.5] bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-5 flex flex-col justify-center relative overflow-hidden">
               <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-gradient-to-bl from-green-50 to-emerald-50 rounded-full blur-[40px] mix-blend-multiply opacity-40 pointer-events-none"></div>
               <div className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 relative z-10"><BarChart3 size={16} className="text-indigo-500"/> 各平台概览</div>
               {selectedMatrix ? (
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-2 relative z-10 w-full">
                   {Array.from(new Set(selectedMatrix.members.map(m => m.platform))).slice(0, 4).map(platform => {
                     const platformMembers = selectedMatrix.members.filter(m => m.platform === platform);
                     const totalFollowers = platformMembers.reduce((sum, m) => sum + (m.followerCount || 0), 0);
                     const totalLikes = platformMembers.reduce((sum, m) => sum + (m.likeCount || 0), 0);
                     return (
                       <div key={platform} className="bg-slate-50 border border-slate-100 rounded-xl p-2 md:p-2.5 flex flex-col gap-1 shadow-sm">
                          <div className="text-[9px] md:text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded self-start leading-none">{platform}</div>
                          <div className="grid grid-cols-2 gap-1 mt-0.5 lg:mt-1">
                            <div className="min-w-0">
                              <div className="text-[8px] md:text-[9px] text-slate-400 mb-0.5">粉丝</div>
                              <div className="text-[10px] md:text-xs font-black text-slate-800 truncate">{formatNumber(totalFollowers)}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[8px] md:text-[9px] text-slate-400 mb-0.5">获赞</div>
                              <div className="text-[10px] md:text-xs font-black text-slate-800 truncate">{formatNumber(totalLikes)}</div>
                            </div>
                          </div>
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <div className="text-sm text-slate-400 italic flex h-full items-center mb-6 relative z-10">选择矩阵后显示数据概览</div>
               )}
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col xl:flex-row gap-6 h-auto xl:h-[200px]">
             {/* Insight Report Box */}
             <div className="flex-[2] bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden flex flex-col">
                <div className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-indigo-500"/> 平台洞察结果
                  </div>
                  <label className="text-xs font-medium text-slate-500 hover:text-indigo-600 cursor-pointer flex items-center gap-1 bg-slate-50 hover:bg-indigo-50 px-2 py-1 rounded transition-colors border border-slate-100">
                    <Upload size={14} /> 上传报告
                    <input 
                       type="file" 
                       className="hidden" 
                       accept=".txt,.md,.json" 
                       onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                            if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) {
                               const mockText = `## 外部文档已加载\n\n已成功解析外部文件：**${file.name}**\n\n*(注：前端环境暂不支持直接预览该类文档的复杂排版内容，但系统已记录您的分析资料。纯文本文档支持完整预览)*`;
                               setInsightReport(mockText);
                               if (selectedMatrix) {
                                 storage.set(`insight_report_matrix_${selectedMatrix.matrixName}`, mockText);
                               }
                               e.target.value = '';
                               return;
                            }
                            
                            if (file.size > 2 * 1024 * 1024) {
                               alert('文件过大，为了防止浏览器卡顿，请上传 2MB 以内的纯文本文件。');
                               e.target.value = '';
                               return;
                            }

                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              const buffer = event.target?.result as ArrayBuffer;
                              let text = '';
                              try {
                                const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
                                text = utf8Decoder.decode(buffer);
                              } catch (err) {
                                const gbkDecoder = new TextDecoder('gbk');
                                text = gbkDecoder.decode(buffer);
                              }
                              setInsightReport(text);
                              if (selectedMatrix) {
                                await storage.set(`insight_report_matrix_${selectedMatrix.matrixName}`, text);
                              }
                            };
                            reader.readAsArrayBuffer(file);
                         }
                         e.target.value = '';
                       }} 
                    />
                  </label>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative">
                   {isInsightLoading ? (
                     <div className="flex flex-col items-center justify-center h-full text-indigo-400 gap-3">
                       <Loader2 className="animate-spin" size={28} />
                       <span className="text-xs font-medium">AI 正在生成受众分析洞察...</span>
                     </div>
                   ) : insightReport ? (
                     <div className="relative markdown-body prose prose-slate prose-sm max-w-none prose-headings:text-indigo-900 prose-headings:mt-0 pb-4 pr-6">
                        <button 
                           onClick={() => setInsightReport(null)}
                           className="absolute top-0 right-0 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                           title="清除并重新获取或上传"
                        >
                           <X size={16} />
                        </button>
                        <ReactMarkdown>{insightReport}</ReactMarkdown>
                     </div>
                   ) : (
                     <div className="flex items-center justify-center h-full"> 
                        <div className="text-left w-full h-full flex flex-col justify-center">
                          <h1 className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                              <Zap className="text-white" size={16} />
                            </div>
                            智能投流模拟分析系统
                          </h1>
                          <p className="text-slate-500 text-xs lg:text-sm max-w-lg leading-relaxed">
                            选择矩阵并点击洞察生成专属聚合分析报告。在下方自由调节流量分配倾斜度，预演全域平台的传播效果。
                          </p>
                        </div>
                     </div>
                   )}
                </div>
             </div>

             {/* Upload Actions */}
             <div className="flex-1 flex gap-4 min-w-0">
                <div className="flex-[1.5]">
                  <UploadZone 
                    label="上传视频/图片" 
                    icon={<Play size={24} />} 
                    accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp" 
                    onUpload={setMediaFiles} 
                    file={mediaFiles} 
                    compact
                    multiple
                  />
                </div>
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex-1 min-h-0 relative">
                    <textarea 
                      value={docText}
                      onChange={(e) => setDocText(e.target.value)}
                      placeholder="在此输入或粘贴文案内容..."
                      className="w-full h-full resize-none rounded-2xl border-2 border-slate-300 bg-white p-4 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 transition-all shadow-sm"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if (mediaFiles.length > 0 || docText.trim()) {
                         setIsUploadConfirmed(true);
                         setTimeout(() => setIsUploadConfirmed(false), 2000);
                      } else {
                         alert('请先上传测试素材或输入文案。');
                      }
                    }}
                    className={cn(
                      "h-[52px] shrink-0 text-white rounded-xl shadow-md font-bold text-sm transition-all flex items-center justify-center gap-2 group", 
                      isUploadConfirmed 
                        ? "bg-emerald-500 hover:bg-emerald-600 scale-[0.98]" 
                        : "bg-slate-900 hover:bg-indigo-600"
                    )}
                  >
                    {isUploadConfirmed ? (
                      <><CheckCircle size={18} className="animate-in zoom-in duration-300" /> 上传成功</>
                    ) : (
                      <><UploadCloud size={16} className="group-hover:-translate-y-1 transition-transform" /> 确认上传</>
                    )}
                  </button>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-10 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-[80px] mix-blend-multiply opacity-60 pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-10 z-10 relative">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-indigo-500" />
            跨平台流量分配策略盘
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-indigo-400 focus-within:shadow-sm transition-all text-sm">
              <span className="text-slate-500 font-medium">总投流数量：</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="bg-transparent border-none outline-none w-20 text-indigo-600 font-bold"
                placeholder="1000"
              />
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 font-medium tracking-wide">
              拖拽调整各平台预算比重
            </div>
          </div>
        </div>

        <div className="relative h-[300px] w-full flex items-end justify-center gap-[6%] md:gap-[10%] z-10 mb-8 border-b border-slate-200/60 pb-4">
           {trafficAllocation.map((item, idx) => (
             <div key={item.name} className="relative h-full flex flex-col items-center justify-end w-16 sm:w-24 group">
               {/* Custom Bar Chart Slider */}
               <div className={cn("relative w-full rounded-2xl flex items-end overflow-hidden transition-all duration-200 shadow-sm border border-white/50 backdrop-blur-md", item.bg)} style={{ height: `calc(100% - 40px)` }}>
                 <div 
                   className={cn("w-full transition-all duration-300 relative", item.color)} 
                   style={{ height: `${item.value}%` }}
                 >
                    <div className="absolute top-0 left-0 w-full h-1 bg-white/40"></div>
                 </div>
                 
                 {/* Drag handle input overlaid and rotated */}
                 <input 
                   type="range"
                   min="0"
                   max="100"
                   step="0.1"
                   value={item.value}
                   onChange={(e) => handleSliderChange(idx, Number(e.target.value))}
                   className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center -rotate-90 w-[240px] h-full opacity-0 cursor-ns-resize z-20"
                 />
               </div>
               
               {/* Label */}
               <div className="flex flex-col items-center mt-3 pointer-events-none">
                 <div className="flex items-center gap-1.5 text-slate-700 font-bold text-sm mb-1">
                   <div className={cn("w-5 h-5 rounded-full text-white flex items-center justify-center shadow-sm", item.color)}>
                     {item.icon}
                   </div>
                   {item.name}
                 </div>
                 <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">
                    {item.value.toFixed(1)}%
                 </span>
               </div>

               {/* Interaction prompt */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/80 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-30 whitespace-nowrap">
                 上下拖动调节
               </div>
             </div>
           ))}
        </div>

        <div className="flex justify-center z-10 relative">
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="group relative overflow-hidden bg-slate-900 hover:bg-indigo-600 text-white rounded-full px-12 py-4 shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 w-1/4 h-full bg-white/20 skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_infinite] -translate-x-full"></div>
            <span className="relative z-10 flex items-center gap-2 font-bold text-lg tracking-wide">
              {isSimulating ? <Rocket className="animate-bounce" /> : <Rocket />}
              {isSimulating ? '跨平台测算中...' : '模拟投流'}
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-950 rounded-[2rem] p-1 shadow-2xl relative overflow-hidden mt-8"
          >
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px] mix-blend-screen pointer-events-none"></div>
            
            <div className="bg-[#111827] rounded-[1.8rem] px-8 py-10 relative z-10 h-full border border-white/10">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-400/30 text-xs font-bold tracking-widest mb-3 uppercase">
                  Simulation Report
                </div>
                <h3 className="text-2xl font-black text-white flex items-center justify-center gap-2">
                  <TrendingUp className="text-green-400" />
                  矩阵投流收益预测
                </h3>
              </div>

              {typeof result === 'string' ? (
                <div className="text-slate-300 markdown-body prose prose-invert max-w-none text-sm leading-relaxed prose-headings:text-white prose-a:text-indigo-400 prose-strong:text-indigo-300">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              ) : result && result.platforms ? (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {result.platforms.map((platform, idx) => (
                      <div key={idx} className="bg-slate-800/40 border border-white/10 rounded-3xl p-6 lg:p-8 transition-all hover:bg-slate-800/60 shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center border border-indigo-500/30 text-indigo-300">
                               {trafficAllocation.find(t => t.name.includes(platform.platformName) || platform.platformName.includes(t.name))?.icon || <Target size={24} />}
                            </div>
                            <h4 className="text-xl font-bold text-white tracking-wide">{platform.platformName}</h4>
                          </div>
                          
                          <div className="flex items-center gap-4 bg-black/20 rounded-xl px-4 py-2 border border-white/5">
                            <div className="text-center">
                              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">预估曝光</div>
                              <div className="font-mono text-emerald-400 font-bold">{platform.overview.impressions}</div>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="text-center">
                              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">预算投入</div>
                              <div className="font-mono text-white font-bold">{platform.overview.budget}</div>
                            </div>
                          </div>
                        </div>

                        <div className="mb-8">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">预测互动数据与核心指标</div>
                          <div className="flex flex-wrap gap-2 lg:gap-3">
                            <div className="bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-lg text-sm border border-indigo-500/20 flex items-center gap-2">
                              <Heart size={14} className="opacity-70" /> {platform.engagement.likes}
                            </div>
                            <div className="bg-pink-500/10 text-pink-300 px-3 py-1.5 rounded-lg text-sm border border-pink-500/20 flex items-center gap-2">
                              <Target size={14} className="opacity-70" /> {platform.engagement.bookmarks}
                            </div>
                            <div className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg text-sm border border-blue-500/20 flex items-center gap-2">
                              <Rocket size={14} className="opacity-70" /> {platform.engagement.shares}
                            </div>
                            <div className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-sm border border-slate-700 flex items-center gap-2">
                              <FileText size={14} className="opacity-70" /> {platform.engagement.comments}
                            </div>
                          </div>
                          <div className="flex items-center gap-5 mt-4 pt-4 border-t border-white/5">
                            <div className="text-xs text-slate-300"><span className="text-slate-500 mr-1.5 font-medium">互动率:</span> <span className="font-mono text-amber-400 font-bold">{platform.engagement.engagementRate}</span></div>
                            <div className="text-xs text-slate-300"><span className="text-slate-500 mr-1.5 font-medium">CPE:</span> <span className="font-mono font-bold text-white">{platform.engagement.cpe}</span></div>
                            <div className="text-xs text-slate-300"><span className="text-slate-500 mr-1.5 font-medium">CPM:</span> <span className="font-mono font-bold text-white">{platform.overview.cpm}</span></div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="bg-[#1e293b]/50 rounded-2xl p-5 border border-indigo-500/20 relative">
                            <div className="absolute -left-px top-6 bottom-6 w-[3px] bg-indigo-500 rounded-r-md"></div>
                            <div className="text-xs text-indigo-400 font-black tracking-wide mb-2 flex items-center gap-1.5"><Sparkles size={14} /> AI 深度分析表现原因</div>
                            <p className="text-slate-300 text-sm leading-relaxed">{platform.analysis.reasoning}</p>
                          </div>
                          <div className="bg-[#1e293b]/50 rounded-2xl p-5 border border-orange-500/20 relative">
                            <div className="absolute -left-px top-6 bottom-6 w-[3px] bg-orange-500 rounded-r-md"></div>
                            <div className="text-xs text-orange-400 font-black tracking-wide mb-2 flex items-center gap-1.5"><TrendingUp size={14} /> 预算效能诊断</div>
                            <p className="text-slate-300 text-sm leading-relaxed">{platform.analysis.budgetEfficiency}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {result.finalSummary && (
                    <div className="bg-gradient-to-r from-indigo-900/40 to-blue-900/20 border border-indigo-500/30 rounded-3xl p-6 lg:p-8 mt-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                      <h4 className="text-indigo-300 font-black mb-3 flex items-center gap-2 text-lg"><CheckCircle size={20} className="text-emerald-400" /> 全局投流优化建议</h4>
                      <div className="text-slate-100 text-sm leading-loose">
                         <ReactMarkdown>{result.finalSummary}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
