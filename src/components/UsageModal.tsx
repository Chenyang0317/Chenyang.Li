import React, { useState, useEffect } from 'react';
import { X, Activity, DollarSign, Globe, TrendingUp } from 'lucide-react';
import { storage } from '../lib/storage';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { cn } from '../lib/utils';

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UsageModal({ isOpen, onClose }: UsageModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    apiCalls: 0,
    apiCallsTrend: 0,
    balanceSpend: 0,
    balanceSpendTrend: 0,
    freeCreditSpend: 0,
    freeCreditSpendTrend: 0,
    endpointsUsed: 0
  });

  useEffect(() => {
    if (isOpen) {
      fetchUsage();
    }
  }, [isOpen]);

  const fetchUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = await storage.get<string>('tikhub_api_key');
      if (!apiKey) {
        throw new Error('未配置 API Key');
      }

      // We use proxy to bypass CORS
      const res = await fetch('/api/tikhub/api/v1/tikhub/user/get_user_daily_usage', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`请求失败 (${res.status})`);
      }

      const raw = await res.json();
      console.log('TIKHUB USAGE RAW:', raw);

      // Guessing the data structure based on typical tikhub responses
      // Usually data.data contains the list of daily usage
      const actualData = raw.data || raw;
      
      if (actualData && actualData.date && actualData.total_request_per_day !== undefined) {
         // Process single day data
         const totalCalls = actualData.total_request_per_day || 0;
         const totalBalance = actualData.balance_usage || 0;
         const totalFree = actualData.free_credit_usage || 0;
         const uriCounts = actualData.uri_counts || {};
         const endpointsUsed = Object.keys(uriCounts).length;

         setSummary({
            apiCalls: totalCalls,
            apiCallsTrend: 0,
            balanceSpend: totalBalance,
            balanceSpendTrend: 0,
            freeCreditSpend: totalFree,
            freeCreditSpendTrend: 0,
            endpointsUsed: endpointsUsed
         });

         // Format URI endpoints data for charting
         const endpointData = Object.entries(uriCounts).map(([uri, count]) => {
             // Extract just the last part of the URI for better display
             const parts = uri.split('/');
             const shortName = parts[parts.length - 1] || uri;
             return {
                 name: shortName,
                 fullUri: uri,
                 calls: count
             };
         }).sort((a: any, b: any) => b.calls - a.calls); // Sort by highest usage

         // Set data as the endpoint breakdown
         setData(endpointData);
      } else {
        throw new Error('未找到用量数据结构: ' + JSON.stringify(actualData).substring(0, 200));
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#F8FAFC] rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
             <div className="bg-green-100 text-green-600 p-2 rounded-xl">
               <Activity size={20} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800">Usage Statistics</h3>
               <p className="text-xs text-slate-500 font-medium">Recent activity summary</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto w-full flex-1">
           {loading ? (
              <div className="py-20 flex flex-col items-center justify-center">
                 <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                 <p className="mt-4 text-sm text-slate-500 font-medium">加载用量数据中...</p>
              </div>
           ) : error ? (
              <div className="py-10 text-center">
                 <p className="text-red-500 font-medium mb-4">{error}</p>
                 <button onClick={fetchUsage} className="px-4 py-2 bg-green-50 text-green-600 rounded-full text-sm font-bold">重试</button>
              </div>
           ) : (
              <div className="space-y-6">
                 {/* Summary Cards */}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                       <div className="flex items-center gap-3 mb-2">
                           <div className="bg-blue-50 text-blue-500 p-1.5 rounded-lg">
                              <TrendingUp size={16} />
                           </div>
                           <span className="text-3xl font-black text-slate-800">{summary.apiCalls}</span>
                       </div>
                       <p className="text-sm font-medium text-slate-500">Today's API Calls</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                       <div className="flex items-center gap-3 mb-2">
                           <div className="bg-green-50 text-green-500 p-1.5 rounded-lg">
                              <DollarSign size={16} />
                           </div>
                           <span className="text-3xl font-black text-slate-800">${summary.balanceSpend.toFixed(4)}</span>
                       </div>
                       <p className="text-sm font-medium text-slate-500">Balance Spend</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                       <div className="flex items-center gap-3 mb-2">
                           <div className="bg-emerald-50 text-emerald-500 p-1.5 rounded-lg">
                              <DollarSign size={16} />
                           </div>
                           <span className="text-3xl font-black text-slate-800">${summary.freeCreditSpend.toFixed(4)}</span>
                       </div>
                       <p className="text-sm font-medium text-slate-500">Free Credit Spend</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                       <div className="flex items-center gap-3 mb-2">
                           <div className="bg-purple-50 text-purple-500 p-1.5 rounded-lg">
                              <Globe size={16} />
                           </div>
                           <span className="text-3xl font-black text-slate-800">{summary.endpointsUsed || '--'}</span>
                       </div>
                       <p className="text-sm font-medium text-slate-500">Endpoints Used</p>
                    </div>
                 </div>

                 {/* Charts */}
                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm w-full">
                     <h4 className="font-bold text-slate-800 mb-1">API Endpoints Breakdown</h4>
                     <p className="text-xs text-slate-500 mb-6">Which APIs were called today and how many times</p>
                     
                     {data.length > 0 ? (
                         <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                   <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                                   <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                   <Tooltip 
                                     cursor={{fill: '#f8fafc'}}
                                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                     formatter={(value: number) => [`${value} calls`, 'Usage']}
                                     labelFormatter={(label) => `Endpoint: ${label}`}
                                   />
                                   <Bar dataKey="calls" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                     ) : (
                         <div className="h-40 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                            <p className="text-sm text-slate-400">今日暂无详细 API 调用记录</p>
                         </div>
                     )}
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
