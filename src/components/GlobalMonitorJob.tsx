import React, { useEffect, useRef } from 'react';
import { UnifiedUserProfile, fetchUserVideos, fetchVideoComments, PlatformType } from '../lib/platforms';
import { analyzeMonitorData, MonitorDataResult } from '../lib/gemini';
import { storage } from '../lib/storage';

function formatMessageForFeishu(results: { blogger: UnifiedUserProfile, result: MonitorDataResult }[]) {
  const elements = results.map(item => {
    const metricsText = item.result.metrics.map(m => {
      const icon = m.change >= 0 ? '📈' : '📉';
      return `- **${m.name}**: ${Math.round(m.current)} (历史均值: ${Math.round(m.average)}) ${icon} ${m.change > 0 ? '+' : ''}${m.change}%`;
    }).join('\n');

    return [
      {
        "tag": "div",
        "fields": [
          {
            "is_short": true,
            "text": {
              "tag": "lark_md",
              "content": `**博主：** ${item.blogger.nickname} (${item.blogger.platform})`
            }
          },
          {
            "is_short": true,
            "text": {
              "tag": "lark_md",
              "content": `**最新视频结论：**\n${item.result.commentSummary}`
            }
          }
        ]
      },
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": `**数据对比：**\n${metricsText}`
        }
      },
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": `**波动分析：**\n${item.result.analysis}`
        }
      },
      { "tag": "hr" }
    ];
  }).flat();

  return {
    "msg_type": "interactive",
    "card": {
      "elements": [
        {
          "tag": "markdown",
          "content": "**📢 每日智能监控报告 (早上 9:00)**"
        },
        { "tag": "hr" },
        ...elements,
        {
          "tag": "note",
          "elements": [
            {
              "tag": "plain_text",
              "content": "此报告由 AI Studio Data Agent 自动生成"
            }
          ]
        }
      ],
      "header": {
        "template": "blue",
        "title": {
          "content": "📊 博主全量自动监控",
          "tag": "plain_text"
        }
      }
    }
  };
}

let isGlobalMonitorRunning = false;

export async function runMonitorAndSendFeishu() {
  if (isGlobalMonitorRunning) return;
  
  try {
    isGlobalMonitorRunning = true;
    const feishuUrl = await storage.get<string>('feishu_webhook_url');
    if (!feishuUrl) {
       console.log("未配置飞书机器人 Webhook URL，跳过自动监控发送。");
       return;
    }

    const savedList = await storage.get<UnifiedUserProfile[]>('saved_bloggers') || [];
    if (savedList.length === 0) return;

    const monitorResults: { blogger: UnifiedUserProfile, result: MonitorDataResult }[] = [];

    // Existing monitorData so we don't clear old data randomly, actually we update it
    const cachedMonitorData = await storage.get<Record<string, MonitorDataResult>>('monitorData') || {};

    for (const blogger of savedList) {
      if (!blogger || !blogger.id) continue;
      
      const bloggerKey = `${blogger.platform}-${blogger.id}`;
      
      try {
        const videoRes = await fetchUserVideos(blogger.platform as PlatformType, blogger.id, 0, 0, 'user', 0);
        const videos = videoRes.videos;
        
        if (videos.length < 2) continue; // Not enough videos

        const latestVideo = videos[0];
        const pastVideos = videos.slice(1, 10); 

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
        
        cachedMonitorData[bloggerKey] = result;
        monitorResults.push({ blogger, result });
        
        // Delay to simulate real human req, avoid rate lim
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
           console.error(`Failed to monitor ${blogger.nickname}: `, err);
      }
    }

    // Save the updated cache mapping back so the UI reflects it
    await storage.set('monitorData', cachedMonitorData);

    if (monitorResults.length > 0) {
      const payload = formatMessageForFeishu(monitorResults);
      await fetch(feishuUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

  } catch (e) {
    console.error("GlobalMonitor Error", e);
  } finally {
    isGlobalMonitorRunning = false;
  }
}

export function GlobalMonitorJob() {
  const checkInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Run check every minute to see if it's 9:00 AM GMT+8
    checkInterval.current = setInterval(() => {
      checkAndRunJob();
    }, 60000);

    // Initial check when component mounts
    checkAndRunJob();

    return () => {
      if (checkInterval.current) clearInterval(checkInterval.current);
    };
  }, []);

  const checkAndRunJob = async () => {
    try {
      const now = new Date();
      
      // Calculate GMT+8 (Beijing Time) hours and minutes
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const nd = new Date(utc + (3600000 * 8));
      
      const hours = nd.getHours();
      
      // We want to run anytime after 09:00 if it hasn't run today
      if (hours >= 9) {
        // Prevent multiple runs in the same day
        const lastRunStr = await storage.get<string>('last_daily_monitor_run');
        const todayStr = `${nd.getFullYear()}-${nd.getMonth() + 1}-${nd.getDate()}`;
        
        if (lastRunStr !== todayStr) {
          console.log('触发每天早上9点钟(GMT+8)自动运行监控并发送至飞书机器人...');
          await storage.set('last_daily_monitor_run', todayStr);
          await runMonitorAndSendFeishu();
        }
      }
    } catch (e) {
      console.error('Failed to run scheduled job:', e);
    }
  };

  return null; // Invisible component
}
