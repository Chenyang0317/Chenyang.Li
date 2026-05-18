import { GoogleGenAI } from '@google/genai';
import { storage } from './storage';

export function checkIsOnPlatform(): boolean {
  return document.cookie.includes('X-Platform=1');
}

export function getGeminiClient() {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || 'dummy-key';
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      baseUrl: checkIsOnPlatform() ? `${location.origin}/api/llm/proxy` : undefined,
    },
  });
}

export interface VideoAnalysisResult {
  summary: string;
  structure: {
    type: 'vo' | 'no_vo';
    vo?: string;
    videoDescription: string;
    duration: number;
    tag: string;
  }[];
}

export interface CommentAnalysisResult {
  summary: string;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || 
                          error?.message?.includes('RESOURCE_EXHAUSTED') ||
                          error?.message?.includes('Quota exceeded');
      
      if (isRateLimit && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Gemini API rate limited. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function performBochaWebSearch(query: string): Promise<string> {
  const apiKey = await storage.get<string>('bocha_api_key');
  if (!apiKey) return '';

  try {
    const response = await fetch('https://api.bocha.cn/v1/web-search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: query })
    });
    
    if (!response.ok) {
       console.warn("Bocha API returned status:", response.status);
       return '';
    }
    const data = await response.json();
    
    // Try to extract text if it matches known patterns or just stringify
    if (data?.data?.webPages?.value) {
       return data.data.webPages.value.map((p: any) => 
         `Title: ${p.name || p.title}\nSnippet: ${p.snippet || p.summary}`
       ).join('\n\n');
    }
    
    // Fallback serialization, limit size
    return JSON.stringify(data).slice(0, 4000);
  } catch(e) {
    console.error("Bocha web search request failed:", e);
    return '';
  }
}

export async function analyzeVideo(videoData: any): Promise<VideoAnalysisResult> {
  return withRetry(async () => {
    let webContext = '';
    // try to get some context for the video title
    if (videoData.title) {
       webContext = await performBochaWebSearch(`关于视频主题或新闻：“${videoData.title}”的最新内容与客观背景`);
    }

    const ai = getGeminiClient();
    
    const prompt = `# 视频文件基础信息与ASR结果
\`\`\`json
${JSON.stringify({ title: videoData.title, desc: videoData.title, videoUrl: videoData.videoUrl, duration: videoData.duration }, null, 2)}
\`\`\`
${webContext ? `
# 互联网相关实时背景信息 (由Bocha Web Search提供)
\`\`\`text
${webContext}
\`\`\`
` : ''}

<instruction>
1. **任务理解**：
   - 你需要**结合现实平台的环境、实时的互联网新闻与讨论背景**（参考提供的背景信息），来深度分析用户提供的视频内容及其语音转文字结果。
   - 视频包含口播（vo）或无口播（no_vo）片段。
   - 目标有三个：
     1. 联系当前的现实社会环境、受众当前痛点或近期热点新闻，解读该视频为何能踩中流量密码；
     2. 拆解视频的结构，输出带有卖点、画面、时长等信息的结构化结果；
     3. 总结视频的热门原因，并归纳出一条具有高度实操性、且适应当前传播环境的 **内容结构公式**。

2. **内容结构公式**：
   - 根据文案与画面，抽象总结视频的可复刻结构，用公式形式表达（例如：冲突新闻/热点开场 + 现实痛点揭示 + 共情/解决方案 + CTA-引导互动）。
   - 每个部分要用 **简短但具象化的名称**，能让他人快速联想到画面并复刻相似内容。

3. **排版与结构要求 (重要)**：
   - 使用 Markdown 格式进行排版，确保 **主次分明、结构清晰**。
   - 使用 \`###\` 作为一级大版块标题，使用 \`####\` 作为二级细分小标题。
   - 每个版块标题前加一个相关的 Emoji（如：🌍, 🚀, 📈, 🎨, 💡等）。
   - 关键结论、核心卖点、爆款公式必须 **加粗** 并可以用 \`> \` 引用块进行强调。
   - 所有的分析项必须使用无序列表 \`-\`。
   - \`summary\` 必须严格按以下导航结构输出：
     - ### 🌍 现实社会背景与热点关联 (基于实时检索)
     - ### 🚀 核心爆款逻辑 (公式化表达)
     - ### 📈 内容深度剖析
       - #### 1. 核心导向与卖点
       - #### 2. 用户痛点直击 (结合当下大环境)
       - #### 3. 互动与转化策略
     - ### 🎨 视觉与表达技巧
       - #### 1. 开场前3秒策略
       - #### 2. 画面排版与节奏
     - ### 💡 适应当下环境的复刻建议与清单

4. **视频解析要求**：
   - 将视频分段，每段包含类型、文案、画面描述、时长和标签。
   - ASR提取内容需修正错别字，但不要改写。

5. **输出格式**：最终输出必须为JSON对象，包含\`summary\`和\`structure\`字段。
6. **注意事项**：必须直接输出 JSON 对象，不要使用 markdown code block 格式包裹。
</instruction>

<examples>
<example>
    输入：一个美食制作视频，开头是口播介绍菜品，中间是无口播的烹饪过程，结尾是口播引导点赞。
    输出：
    {
      "summary": "### 🌍 现实社会背景与热点关联\\n- 结合快节奏的都市生活，年轻人缺乏做饭时间，但对健康饮食的要求日益变高，相关讨论热度极高。\\n\\n### 🚀 核心爆款逻辑\\n- **内容公式**：痛点热点开场 + 快速制作 + CTA-引导互动\\n\\n### 📈 内容深度剖析\\n#### 1. 核心导向与卖点\\n- 突出“5分钟搞定”，解决快节奏人群缺乏做饭时间的痛点。\\n#### 2. 用户痛点直击 (结合大环境)\\n- 针对白领社交圈“没时间做饭”且外卖新闻频发的担忧心理。\\n\\n### 🎨 视觉与表达技巧\\n#### 1. 开场前3秒策略\\n- 直接甩出‘5分钟米其林牛排’成片画面。\\n#### 2. 画面排版与节奏\\n- 烹饪快剪，动感配乐。\\n\\n### 💡 适应当下环境的复刻建议\\n- 保持高频节奏，结尾强制引导点赞。",
      "structure": [
        {
          "type": "vo",
          "vo": "今天教大家，5分钟搞定米其林同款牛排！",
          "videoDescription": "主播手持牛排，镜头特写",
          "duration": 1.5,
          "tag": "激情开场"
        },
        {
          "type": "no_vo",
          "videoDescription": "平底锅煎牛排，慢镜头展示汁水",
          "duration": 2,
          "tag": "快速制作"
        },
        {
          "type": "vo",
          "vo": "学会记得点赞。",
          "videoDescription": "引导点赞关注的镜头",
          "duration": 1,
          "tag": "CTA-引导互动"
        }
      ]
    }
</example>
</examples>`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    }
  });

  if (!response.text) {
    throw new Error('No response from AI');
  }
  
  try {
    let cleanJson = response.text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Failed to parse AI response: ' + response.text);
    }
  });
}

export async function analyzeMultiVideoComments(videosWithComments: any[]): Promise<CommentAnalysisResult> {
  return withRetry(async () => {
    const ai = getGeminiClient();
    
    const contextData = videosWithComments.map(v => ({
      title: v.title,
      videoUrl: v.videoUrl,
      comments: v.comments.map((c: any) => ({ text: c.text, likeCount: c.likeCount }))
    }));

    const prompt = `# 视频及其热点评论数据
\`\`\`json
${JSON.stringify(contextData, null, 2)}
\`\`\`

<instruction>
1. **任务理解**：我们需要对给定的一批视频的评论数据进行专业级深度分析，从而挖掘用户关注的核心要点和商业价值。
2. **排版与结构要求 (重要)**：
   - 使用 Markdown 格式进行排版，确保 **主次分明、结构清晰**。
   - 使用 \`###\` 作为主要分析维度大标题，使用 \`####\` 作为其内部的二级细分观点。
   - 每个大标题前需带上识别度高的 Emoji。
   - 用户画像特征、高频率关键词、核心诉求核心必须 **加粗**。
   - 所有的详细分析必须使用列表形式。
3. **分析维度导航结构 (按照此结构顺序输出)**：
   - ### 🌍 核心洞察摘要 (Top-Level Summary)
   - ### 📊 【语义分析】情感倾向与核心关键词
     - #### 1. 用户情绪反馈 (多/中/负)
     - #### 2. 评论区高频词云
   - ### 🔍 【话题洞察】聚类关注点：卖点 / 痛点 / 趋势
     - #### 1. 受众最感兴趣的卖点
     - #### 2. 用户集中的疑问与痛点
   - ### ⚖️ 【竞品/对比分析】用户评价差异与选择理由
   - ### 🏷️ 【VOC 标签体系】结构化资产沉淀
   - ### 💡 【业务建议】内容优化与转化策略
     - #### 1. 下一期视频选题建议
     - #### 2. 评论区运营/回复策略
4. **输出格式要求**：
   - 直接返回 JSON 对象，包含 \`summary\` 字段。
   - \`summary\` 字段请使用上述定义的 Markdown 结构进行详细编排。
   - 禁止使用 md code block 包住 json。
</instruction>`;

    const commentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    if (!commentResponse.text) {
      throw new Error('No response from AI');
    }
    
    try {
      let cleanJson = commentResponse.text.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      return JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Failed to parse AI response: ' + commentResponse.text);
    }
  });
}

export interface BloggerValueResult {
  score: number;
  dimensions: {
    originality: number;
    purchasingPower: number;
    brandFit: number;
    growth: number;
  };
  report: string;
}

export async function analyzeBloggerValue(profile: any, videos: any[]): Promise<BloggerValueResult> {
  return withRetry(async () => {
    const ai = getGeminiClient();
    
    const videoListText = videos.slice(0, 20).map(v => `${v.title || '无标题'} | 点赞: ${v.statistics?.likeCount || 0}`).join('\n');
    
    const prompt = `# Role
你是一位拥有 10 年经验的社交媒体增长专家与品牌投放总监（CMO），擅长通过有限的公开指标（Open-source Intelligence）分析账号的底层商业逻辑与变现潜力。

# Objective
请针对提供的社交媒体账号数据进行全方位的“商业审计”。你不仅要给出分数，还要拆解该账号在广告投放、IP 孵化及私域转化的具体价值，并输出一份专业报告。

# Data Input
- **基本画像**：名称 [${profile.nickname}], 简介 [${profile.signature || '无'}]
- **体量指标**：粉丝总数 [${profile.followerCount || 0}], 累计获赞 [${profile.likeCount || 0}]
- **内容样本（近期视频）**：
${videoListText}

# Analysis Methodology (思维链推理)
在给出最终评分前，请按以下逻辑进行内部运算：
1. **互动能级 (Engagement Level)**：计算平均单篇点赞与粉丝数的比率。
2. **粉丝含金量 (Follower Quality)**：对比总赞粉比。若赞粉比极高，说明内容驱动；若极低，说明可能存在人设粘性或僵尸粉干扰。
3. **内容专业性 (Niche Authority)**：分析简介与标题中的关键词。区分是“泛流量（低单价）”还是“垂直流量（高单价）”。
4. **情感附加值 (Emotional Value)**：分析博主是否具有明确的辨识度或解决问题的工具属性。

# Output Format (JSON)
请严格返回JSON对象，必须包含 \`score\` (数字0-100), \`dimensions\` 和 \`report\` 字段。\`dimensions\` 包含 originality(原创力1-5), purchasingPower(粉丝购买力1-5), brandFit(品牌适配度1-5), growth(增长潜力1-5)。\`report\` 字段的内容按以下结构输出极致详细、逻辑缜密、包含深度的 Markdown 格式全景审计长文报告：

---
### 1. 核心画像与深度定位
- **账号心智标签**：[用 3-4 个精准的词语归纳，例如：AI工作流降本增效专家 / 独立女性成长向导]
- **受众人群与痛点解码**：[详细解析该账号吸引了哪类精准人群，这类人群的消费能力、核心诉求及消费痛点是什么，不少于 100 字]
- **内容范式分析**：[深度拆解该博主的视觉表现、叙事结构、人设记忆点等，如何做到持续吸引粉丝，不少于 100 字]

### 2. 商业变现潜力与策略矩阵
- **商业溢价空间 (Ad Value)**：结合所处赛道，深层预估该账号在当前垂直领域的报价水位（偏高/持平/偏低）及其溢价点/贬值点所在。
- **最佳转化路径 (Conversion Path)**：推演其最适合的变现模式（例如“情绪共鸣带货”、“专业深度背书”、“供应链分发”），并解释原因。
- **高转化匹配赛道**：最适合与其进行深度合作的 3 个商业行业（需给出具体到细分品类的建议，如“高端功能性护肤”而非泛泛的“美妆”）。

### 3. 高级战略点评 (Executive Summary)
- **护城河与不可替代性**：[挖掘该博主在同类竞品中最难被复制的核心竞争力，例如特定的圈层信任、极高的试错成本等]
- **增长瓶颈与系统隐患**：[洞见数据表象下的隐患，如：内容同质化导致视觉疲劳、高度依赖单一人设、粉丝互动深度衰减等，不少于 100 字]
- **下一步迭代方向**：[给出给该博主未来 3-6 个月的运营与商业化突破建议]
---`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    if (!response.text) {
      throw new Error('No response from AI');
    }
    
    try {
      let cleanJson = response.text.trim();
      if (cleanJson.startsWith('\`\`\`json')) {
        cleanJson = cleanJson.replace(/^\`\`\`json\s*/, '').replace(/\s*\`\`\`$/, '');
      } else if (cleanJson.startsWith('\`\`\`')) {
        cleanJson = cleanJson.replace(/^\`\`\`\s*/, '').replace(/\s*\`\`\`$/, '');
      }
      return JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Failed to parse AI response: ' + response.text);
    }
  });
}

export async function analyzeMultiVideos(videosData: any[]): Promise<VideoAnalysisResult> {
  return withRetry(async () => {
    let webContext = '';
    if (videosData.length > 0) {
       const titles = videosData.slice(0, 3).map(v => v.title).filter(Boolean).join(' ');
       if (titles) {
         webContext = await performBochaWebSearch(`近期社交媒体平台关于以下相关主题：“${titles.slice(0, 60)}”的受众痛点与热门讨论`);
       }
    }

    const ai = getGeminiClient();
    
    const contextData = videosData.map(v => ({ title: v.title, desc: v.title, videoUrl: v.videoUrl, duration: v.duration }));

    const prompt = `# 视频文件基础信息与ASR结果
\`\`\`json
${JSON.stringify(contextData, null, 2)}
\`\`\`
${webContext ? `
# 互联网相关实时背景与趋势信息 (由Bocha Web Search提供)
\`\`\`text
${webContext}
\`\`\`
` : ''}

<instruction>
1. **任务理解**：
   - 你需要**结合互联网实时热点趋势和搜索信息**，分析用户提供的多个视频内容，寻找它们的共同爆款规律。
   - 目标有三个：
     1. 从当前的互联网真实讨论与痛点中解读这批视频的共同底层动机；
     2. 拆解这些优质视频的共性结构，输出带有典型卖点、画面、时长等信息的结构化结果；
     3. 总结视频的热门原因，并归纳出一条适应最新的热点周期与平台环境的 **多视频共性内容结构公式**。

2. **内容结构公式**：
   - 抽象总结这些视频的共性结构，用公式表达（如：钩子开场 + 痛点揭示 + 方案展示 + 实测效果 + CTA）。
   - 每个部分要用 **简短但具象化的名称**。

3. **排版与结构要求 (重要)**：
   - 使用 Markdown 格式进行排版，确保 **大标题和小标题主次分明**。
   - 使用 \`###\` 作为一级版块标题，使用 \`####\` 作为二级细分标题。
   - 共同的“钩子”策略、爆款元素、转化逻辑必须 **加粗**。
   - 每一个主要模块都要有对应的 Emoji 前缀。
   - \`summary\` 必须严格按照以下结构输出：
     - ### 🌍 近期全网趋势与环境洞察 (结合最新背景)
     - ### 🏆 多视频爆款共性公式 (通用复刻结构)
     - ### 🔎 核心共性要素汇总
       - #### 1. 选题视角与切入点共性
       - #### 2. 脚本节奏与文案张力
       - #### 3. 视觉符号与包装共性
     - ### 💬 用户留存与互动密码
     - ### 🛠️ 适应当下环境的模块化复刻建议

4. **输出格式**：最终输出必须为JSON对象，包含\`summary\`和\`structure\`字段。
5. **注意事项**：必须直接输出 JSON 对象，不要使用 markdown code block 格式包裹。
</instruction>`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    if (!response.text) {
      throw new Error('No response from AI');
    }
    
    try {
      let cleanJson = response.text.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      return JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Failed to parse AI response: ' + response.text);
    }
  });
}

export async function analyzePlatformInsight(matrixName: string, members: any[]): Promise<string> {
  const atypicaApiKey = await storage.get<string>('atypica_api_key');
  
  if (!atypicaApiKey) {
    throw new Error('未配置 Atypica API Key，请先在右上角【系统接口设置】中配置');
  }

  let enrichedMembersContext = '';
  for (const p of members) {
     const videos = await storage.get<any[]>(`saved_videos_${p.platform}_${p.id}`) || [];
     enrichedMembersContext += `- ${p.platform}: ${p.nickname} (粉丝 ${p.followerCount}, 获赞 ${p.likeCount || 0})\n`;
     if (videos.length > 0) {
        enrichedMembersContext += `  * 近期代表作品：\n`;
        videos.slice(0, 5).forEach(v => {
           enrichedMembersContext += `    - 《${v.title}》 (播放/点赞预估：${v.metricCount || v.likeCount || '未知'})\n`;
        });
     }
  }

  const prompt = `你是一位拥有 10 年经验的资深全渠道营销策略专家，擅长通过社交媒体大数据进行用户洞察和投流决策分析。你对中国主流社交平台（抖音、B站、小红书、微博）的用户生态、分发逻辑和心理差异有极深的研究。

# Task
我将为您提供矩阵【${matrixName}】以及在各社交平台抓取的对应账号原始数据与近期视频数据如下：
${enrichedMembersContext}

请您基于以上数据，使用 Atypica 的特征挖掘算法，为该矩阵开辟独立分区展示内容。生成详细的用户画像（User Profile），以辅助我制定后续的投流策略。请按以下结构用 Markdown 格式确保各平台画像具有显著的差异化特性：

✨ **由 Atypica.AI 深度洞察生成**

### 📍 平台：[平台名称]
* **核心受众标签**：
  * **职业**：(例如：新晋职场人、在校大学生、精致妈妈等)
  * **年龄段**：(例如：18-25岁，核心圈层集中在哪个区间)
  * **典型生活状态**：(用 3 个关键词描述他们的日常)
* **平台特有心态**：分析该平台用户在浏览此矩阵账号时的心理预期。
* **内容偏好 (Content Appetite)**：最想看到什么内容？
* **典型用户画像描述 (User Voice)**：请用一句话模拟一个真实用户的口吻，描述他为什么关注这个账号。`;

  try {
    const response = await fetch('/api/atypica/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${atypicaApiKey}`
      },
      body: JSON.stringify({
        model: 'atypica-model',
        messages: [
          { role: 'system', content: 'You are Atypica.AI Core Insight Engine.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      let errData = null;
      try {
        errData = await response.json();
      } catch (jsonErr) {
        // Not JSON
        const text = await response.text();
        throw new Error(`Atypica API 请求失败: ${response.status} - 响应非 JSON 格式: ${text.slice(0, 50)}... 请检查 API Proxy 是否正常工作`);
      }
      throw new Error(`Atypica API 请求失败: ${response.status} ${errData ? JSON.stringify(errData) : response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '暂无洞察数据';
  } catch (error: any) {
    console.error('Atypica Insight Error:', error);
    throw new Error(`洞察失败: ${error.message}`);
  }
}

export interface MonitorDataResult {
  commentSummary: string;
  analysis: string;
  metrics: {
    name: string;
    average: number;
    current: number;
    change: number;
  }[];
}

export async function analyzeMonitorData(
  latestVideo: any,
  pastAvgMetrics: { like: number; comment: number; share: number; collect: number },
  comments: any[]
): Promise<MonitorDataResult> {
  return withRetry(async () => {
    const ai = getGeminiClient();

    const commentsText = comments.slice(0, 30).map(c => c.text).join(' | ');

    const prompt = `你是一位专业的数据分析师。请分析该博主最新视频的数据表现与热点评论。

# 输入数据
- 最新视频指标：点赞 ${latestVideo.stats?.likeCount || 0}，评论 ${latestVideo.stats?.commentCount || 0}，分享 ${latestVideo.stats?.shareCount || 0}，收藏 ${latestVideo.stats?.collectCount || 0}
- 历史平均指标：点赞 ${Math.round(pastAvgMetrics.like)}，评论 ${Math.round(pastAvgMetrics.comment)}，分享 ${Math.round(pastAvgMetrics.share)}，收藏 ${Math.round(pastAvgMetrics.collect)}
- 最新视频热点评论样本：${commentsText}

# 任务
1. **热评总结**：总结最新视频下观众的核心反馈、情绪和共鸣点，用一段精炼的话概括（约100字）。
2. **数据异动分析**：对比最新视频与历史平均数据，分析数据上升或下降的潜在原因。例如，如果点赞下降但评论上升，可能是因为内容引发了争议。分析结果控制在150字左右。

# 输出格式 (基于如下JSON)
{
  "commentSummary": "...",
  "analysis": "..."
}

请直接输出JSON字符串，不要使用 markdown code block。`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    if (!response.text) {
      throw new Error('No response from AI');
    }

    let parsed;
    try {
      let cleanJson = response.text.trim();
      if (cleanJson.startsWith('\`\`\`json')) {
        cleanJson = cleanJson.replace(/^\`\`\`json\s*/, '').replace(/\s*\`\`\`$/, '');
      } else if (cleanJson.startsWith('\`\`\`')) {
        cleanJson = cleanJson.replace(/^\`\`\`\s*/, '').replace(/\s*\`\`\`$/, '');
      }
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Failed to parse AI response: ' + response.text);
    }

    return {
      commentSummary: parsed.commentSummary || '暂无总结',
      analysis: parsed.analysis || '暂无分析',
      metrics: [
        { name: '点赞', average: Math.round(pastAvgMetrics.like), current: latestVideo.stats?.likeCount || 0, change: pastAvgMetrics.like > 0 ? Math.round(((latestVideo.stats?.likeCount || 0) - pastAvgMetrics.like) / pastAvgMetrics.like * 100) : 0 },
        { name: '评论', average: Math.round(pastAvgMetrics.comment), current: latestVideo.stats?.commentCount || 0, change: pastAvgMetrics.comment > 0 ? Math.round(((latestVideo.stats?.commentCount || 0) - pastAvgMetrics.comment) / pastAvgMetrics.comment * 100) : 0 },
        { name: '分享', average: Math.round(pastAvgMetrics.share), current: latestVideo.stats?.shareCount || 0, change: pastAvgMetrics.share > 0 ? Math.round(((latestVideo.stats?.shareCount || 0) - pastAvgMetrics.share) / pastAvgMetrics.share * 100) : 0 },
        { name: '收藏', average: Math.round(pastAvgMetrics.collect), current: latestVideo.stats?.collectCount || 0, change: pastAvgMetrics.collect > 0 ? Math.round(((latestVideo.stats?.collectCount || 0) - pastAvgMetrics.collect) / pastAvgMetrics.collect * 100) : 0 },
      ]
    };
  });
}

export interface PlatformSimulationResult {
  platformName: string;
  overview: {
    budget: string;
    impressions: string;
    cpm: string;
  };
  engagement: {
    likes: string;
    bookmarks: string;
    shares: string;
    comments: string;
    engagementRate: string;
    cpe: string;
  };
  analysis: {
    reasoning: string;
    budgetEfficiency: string;
  };
}

export interface SimulationResult {
  platforms: PlatformSimulationResult[];
  finalSummary: string;
}

export async function simulateTrafficPerformance(
  budget: number,
  contentDesc: string,
  platformPersonas: string,
  allocations: { name: string; value: number }[]
): Promise<SimulationResult> {
  return withRetry(async () => {
    const ai = getGeminiClient();

    const allocationStr = allocations.map(a => `• ${a.name}：${a.value.toFixed(1)}%`).join('\n');

    const prompt = `你是一位精通数据建模的社交媒体增长专家，擅长通过内容质量、受众画像与投放预算来预测多平台（抖音、B站、小红书、微博）的传播效果。你拥有海量的各平台投流 ROI 行业基准数据。

# Context
我已经利用 Atypica 生成了四个平台的用户画像（见附件/下文）。现在，我有一个具体的作品需要进行商业投放，请根据我提供的预算分配方案，模拟该作品的最终数据表现。

# Inputs
1. 用户画像：
${platformPersonas}
2. 待投作品信息： ${contentDesc}
3. 总预算： ￥${budget}
4. 分配比例：
${allocationStr}

# Simulation Logic (模拟逻辑约束)
在模拟时，请务必参考以下各平台特性：
• 成本差异： 考虑不同平台的平均 CPM（千次展示成本）。通常 B站 > 小红书 > 抖音 > 微博。
• 互动偏好：
  * 小红书： 高收藏、高转化，但传播爆发力弱。
  * 抖音： 高点赞、高完播率，数据漏斗极大。
  * B站： 投币/长评是核心，CPM 较高，长尾流量强。
  * 微博： 高转发、易出圈，但互动质量（评论深度）可能较低。
• 契合度加权： 如果内容调性与平台画像匹配度极高，请给予一定的流量杠杆（即更低的 CPE/更佳的互动数据）。

# Output Format (JSON Only)
请严格输出一个 JSON 对象，结构如下：
{
  "platforms": [
    {
      "platformName": "平台名",
      "overview": {
        "budget": "￥具体金额",
        "impressions": "预估曝光量",
        "cpm": "￥预估CPM"
      },
      "engagement": {
        "likes": "点赞量",
        "bookmarks": "收藏量",
        "shares": "转发量",
        "comments": "评论量",
        "engagementRate": "互动率",
        "cpe": "预估单次互动成本"
      },
      "analysis": {
        "reasoning": "结合内容特性与平台画像匹配度，深度分析原因",
        "budgetEfficiency": "分析流量浪费或投入不足情况"
      }
    }
  ],
  "finalSummary": "根据模拟结果给出的全局投流建议，并建议如何优化四平台预算比例"
}

必须直接输出 JSON 对象，不要使用 markdown code block 格式包裹。`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      }
    });

    if (!response.text) {
      throw new Error('No response from AI');
    }
    
    try {
      let cleanJson = response.text.trim();
      if (cleanJson.startsWith('\`\`\`json')) {
        cleanJson = cleanJson.replace(/^\`\`\`json\s*/, '').replace(/\s*\`\`\`$/, '');
      } else if (cleanJson.startsWith('\`\`\`')) {
        cleanJson = cleanJson.replace(/^\`\`\`\s*/, '').replace(/\s*\`\`\`$/, '');
      }
      return JSON.parse(cleanJson);
    } catch (e) {
      throw new Error('Failed to parse AI response: ' + response.text);
    }
  });
}
