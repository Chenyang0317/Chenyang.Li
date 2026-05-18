import { UnifiedUserProfile, UnifiedVideo, FetchVideosResult } from './types';
import { storage } from '../storage';

async function getApiKey(): Promise<string> {
    const key = await storage.get<string>('tikhub_api_key');
    if (!key) throw new Error('API Key 未配置，请先在右上角【设置/API】中配置 TikHub API Key。');
    return key;
}

export function extractBilibiliUid(url: string): string | null {
    const match = url.match(/space\.bilibili\.com\/(\d+)/) || url.match(/uid=(\d+)/);
    if (match) return match[1];
    if (/^\d+$/.test(url)) return url;
    return null;
}

export async function fetchBilibiliHashtagProfile(query: string): Promise<UnifiedUserProfile> {
    const cleanTopic = query.trim();
    if (!cleanTopic) throw new Error('无效的 B 站搜索关键词');
    
    return {
        platform: 'B站',
        id: cleanTopic,
        nickname: `#${cleanTopic}`, // Only show topic name
        avatar: '', 
        signature: '话题搜索结果',
        followerCount: 0,
        likeCount: 0,
        videoCount: 0,
    };
}

export async function fetchBilibiliHashtagVideos(keyword: string, page: number, sortType: number): Promise<FetchVideosResult> {
    const apiKey = await getApiKey();
    const cleanKeyword = keyword.trim();
    
    // sortType is ignored for now or mapped if we know how search handles order,
    // usually Bilibili app search has specific order param, but we might just ignore for topic search
    
    const params = new URLSearchParams();
    params.append('keyword', cleanKeyword);
    params.append('pn', String(page === 0 ? 1 : page));
    
    const finalUrl = `/api/tikhub/api/v1/bilibili/app/fetch_search_all?${params.toString()}`;
    
    console.log('Fetching Bilibili Search:', finalUrl);
    
    let res: Response | null = null;
    let errText = '';
    let success = false;
    
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            res = await fetch(finalUrl, { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Accept': 'application/json' 
                }
            });
            
            if (res.ok) {
                success = true;
                break;
            }
            
            errText = await res.text();
            console.error(`Bilibili Search Error (Attempt ${attempt}):`, errText);
            
            if (errText.includes('Please retry') || res.status === 429 || res.status === 502 || res.status === 400) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            } else {
                break;
            }
        } catch (error) {
            console.error(`Bilibili Search Network Error (Attempt ${attempt}):`, error);
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
    
    if (!success || !res) {
        throw new Error(`B站搜索请求失败, 重试后仍未成功: ${res?.status || 'Network Error'} - ${errText}`);
    }
    
    const rawText = await res.text();
    let data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        console.error("Non-JSON response from Bilibili API:", rawText.slice(0, 500));
        throw new Error("B站大网或接口返回了非 JSON 格式数据");
    }
    const actualData = data.data?.data || data.data || data;
    const itemsContainer = data.data?.item || []; // The search items is usually in data.item array according to typical app/fetch_search_all, actually, they might be in actualData directly if it's a list. Wait, in standard fetch_search_all the array might be at data.data.item.
    
    // According to typical Bilibili search result: it contains an array where linktype=='video'.
    // The user's JSON showed objects directly in an array. Assuming actualData is the array, or actualData.item.
    let itemsList: any[] = [];
    if (Array.isArray(actualData)) {
        itemsList = actualData;
    } else if (Array.isArray(actualData.item)) {
        itemsList = actualData.item;
    } else if (Array.isArray(data.data?.item)) {
        itemsList = data.data.item;
    }
    
    const videoItems = itemsList.filter((it: any) => it.linktype === 'video' && it.av);

    const videos: UnifiedVideo[] = videoItems.map((item: any) => {
        const av = item.av;
        let durationMs = 0;
        if (typeof av.duration === 'string' && av.duration.includes(':')) {
            const parts = av.duration.split(':').map(Number);
            if (parts.length === 2) {
                durationMs = (parts[0] * 60 + parts[1]) * 1000;
            } else if (parts.length === 3) {
                durationMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
            }
        }

        const rawPic = av.cover || '';
        const coverUrl = rawPic.startsWith('//') ? `https:${rawPic}` : (rawPic.startsWith('http:') ? rawPic.replace('http:', 'https:') : rawPic);

        // title from search contains <em class="keyword">, we can strip it out to make it clean
        const cleanTitle = (av.title || '').replace(/<em class="keyword">/g, '').replace(/<\/em>/g, '');

        return {
            id: item.param || item.trackid || '',
            title: cleanTitle,
            coverUrl,
            createTime: av.ptime ? av.ptime * 1000 : Date.now(), 
            duration: durationMs,
            platform: 'B站',
            author: {
                id: av.mid?.toString() || '',
                nickname: av.author || '',
                avatar: av.face || ''
            },
            stats: {
                playCount: av.play || 0,
                likeCount: 0,
                commentCount: av.danmaku || 0, // Using danmaku as comment count since search might not have comments
                collectCount: 0,
                shareCount: 0 
            }
        };
    });

    const currentPg = typeof page === 'string' ? parseInt(page) : page;
    const hasMore = videoItems.length >= 10; 

    return {
        videos,
        nextCursor: hasMore ? currentPg + 1 : null,
        hasMore
    };
}

export async function fetchBilibiliUserProfile(query: string): Promise<UnifiedUserProfile> {
    const cleanId = extractBilibiliUid(query) || query.trim();
    const apiKey = await getApiKey();

    const params = new URLSearchParams();
    params.append('uid', String(cleanId));

    const finalUrl = `/api/tikhub/api/v1/bilibili/web/fetch_user_profile?${params.toString()}`;

    try {
        const res = await fetch(finalUrl, { 
            headers: { 
                'Authorization': `Bearer ${apiKey}`, 
                'Accept': 'application/json' 
            }
        });
        
        if (res.ok) {
            const rawText = await res.text();
            let json;
            try {
                json = JSON.parse(rawText);
            } catch (e) {
                console.error("Non-JSON response from Bilibili Profile API:", rawText.slice(0, 500));
                throw new Error("B站大网或接口返回了非 JSON 格式数据");
            }
            
            if (json.code !== 200 && json.status_code !== 0 && json.code !== 0) {
                console.error("TikHub Bilibili profile error:", json);
            }
            
            const data = json.data || {};
            // Inside data, usually there is a 'card' or directly user info depending on the response.
            // Bilibili user profile endpoint typically returns structural data
            const name = data.name || data.card?.name || `B站用户_${cleanId}`;
            const face = data.face || data.card?.face || '';
            const sign = data.sign || data.card?.sign || '';
            const followerCount = data.follower || data.fans || data.card?.fans || data.stat?.follower || 0;
            const likeCount = data.like_num || data.likes || data.stat?.likes || 0;
            const videoCount = data.video || data.video_count || data.archive_count || 0;
            
            return {
                platform: 'B站',
                id: cleanId,
                nickname: name,
                avatar: face, 
                signature: sign || (json.code !== 200 ? json.msg || json.message : ''),
                followerCount: followerCount,
                likeCount: likeCount,
                videoCount: videoCount,
            };
        } else {
             const errorText = await res.text();
             console.error("Bilibili Profile HTTP Error:", errorText);
             if (res.status === 400 && cleanId.length > 12) {
                 throw new Error("抓取失败 (400)：输入的 B站 UID 格式疑似有误，B站 UID 通是由较短的纯数字组成。请确保未混淆抖音或小红书的 ID。");
             }
             throw new Error(`获取B站博主基本信息失败: ${res.status} - ${errorText}`);
        }
    } catch (e) {
        console.error("Failed to fetch Bilibili profile:", e);
    }
    
    // Fallback if failed
    return {
        platform: 'B站',
        id: cleanId,
        nickname: `B站用户_${cleanId}`,
        avatar: '', 
        signature: '正在加载或获取失败...',
        followerCount: 0,
        likeCount: 0,
        videoCount: 0,
    };
}

export async function fetchBilibiliVideoComments(bvid: string, cursor: string = '', count: number = 20) {
    const apiKey = await getApiKey();
    const cleanId = bvid.trim();
    const params = new URLSearchParams();
    params.append('bv_id', cleanId);
    params.append('mode', '3'); // 3=热门, 2=时间
    if (cursor) {
        params.append('next_offset', cursor);
    }
    
    const finalUrl = `/api/tikhub/api/v1/bilibili/app/fetch_video_comments?${params.toString()}`;
    
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    if (!res.ok) {
        throw new Error(`B站请求失败 (${res.status})`);
    }
    
    const rawText = await res.text();
    let data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        console.error("Non-JSON response from Bilibili Comments API:", rawText.slice(0, 500));
        throw new Error("B站大网或接口返回了非 JSON 格式数据");
    }
    console.log('Bilibili Comments Response:', data);

    if (data.code !== 200 && data.status_code !== 0 && data.code !== 0) {
        throw new Error(data.msg || data.message || '获取评论列表失败');
    }
    
    const actualData = data.data?.data || data.data || data;
    let comments = actualData.replies || actualData.comments || [];
    
    // In case of double nesting (TikHub wrapped Bilibili response)
    if (comments.length === 0 && actualData.data) {
        comments = actualData.data.replies || actualData.data.comments || [];
    }
    const cursorObj = actualData.cursor || actualData.data?.cursor || {};
    
    return {
        comments: comments.map((c: any) => ({
            id: c.rpid?.toString() || c.id || '',
            text: c.content?.message || c.text || '',
            likeCount: c.like || c.digg_count || 0,
            createTime: c.ctime || c.create_time || 0,
            author: c.member?.uname || c.user?.nickname || ''
        })),
        hasMore: cursorObj.has_more || cursorObj.next_offset || actualData.has_more === 1 || actualData.has_more === true || comments.length >= 20 || (actualData.page && actualData.page.num < actualData.page.count),
        nextCursor: cursorObj.next_offset?.toString() || ''
    };
}

export async function fetchBilibiliVideos(uid: string, page: number, sortType: number): Promise<FetchVideosResult> {
    const apiKey = await getApiKey();
    const cleanId = extractBilibiliUid(uid) || String(uid).trim();
    
    // Convert sortType to order param as requested
    let order = 'click'; // Users preferred default: 'click' (most played)
    if (sortType === 0) order = 'pubdate';
    if (sortType === 1) order = 'click';
    if (sortType === 2) order = 'stow';
    
    const params = new URLSearchParams();
    params.append('user_id', String(cleanId));
    params.append('page', String(page === 0 ? 1 : page)); // Ensure page starts at 1
    params.append('ps', '20');
    // Note: app endpoint does not support `order` parameter natively as the web endpoint does.

    const finalUrl = `/api/tikhub/api/v1/bilibili/app/fetch_user_videos?${params.toString()}`;
    
    console.log('Fetching Bilibili:', finalUrl);
    
    let res: Response | null = null;
    let errText = '';
    let success = false;
    
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            res = await fetch(finalUrl, { 
                headers: { 
                    'Authorization': `Bearer ${apiKey}`, 
                    'Accept': 'application/json' 
                }
            });
            
            if (res.ok) {
                success = true;
                break;
            }
            
            errText = await res.text();
            console.error(`Bilibili Fetch Error (Attempt ${attempt}):`, errText);
            
            // If it's a known retryable error from TikHub
            if (errText.includes('Please retry') || res.status === 429 || res.status === 502 || res.status === 400) {
                // wait before retry (exponential backoff)
                await new Promise(r => setTimeout(r, 1000 * attempt));
            } else {
                break; // non-retryable error
            }
        } catch (error) {
            console.error(`Bilibili Fetch Network Error (Attempt ${attempt}):`, error);
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
    
    if (!success || !res) {
        throw new Error(`B站视频列表请求失败, 重试后仍未成功: ${res?.status || 'Network Error'} - ${errText}`);
    }
    
    const rawText = await res.text();
    let data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        console.error("Non-JSON response from Bilibili Videos API:", rawText.slice(0, 500));
        throw new Error("B站大网或接口返回了非 JSON 格式数据");
    }
    if (data.code !== 200 && data.status_code !== 0 && data.code !== 0) {
        console.warn("TikHub Bilibili videos response error:", data);
    }
    const actualData = data.data?.data || data.data || data;
    const listContainer = actualData.list || {};
    const items: any[] = listContainer.vlist || actualData.vlist || actualData.item || actualData.archives || [];

    const videos: UnifiedVideo[] = items.map((item: any) => {
        let durationMs = 0;
        const lengthRaw = item.duration || item.length || 0;
        if (typeof lengthRaw === 'string' && lengthRaw.includes(':')) {
            const parts = lengthRaw.split(':').map(Number);
            if (parts.length === 2) {
                durationMs = (parts[0] * 60 + parts[1]) * 1000;
            } else if (parts.length === 3) {
                durationMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
            }
        } else if (typeof lengthRaw === 'number') {
            durationMs = lengthRaw * 1000;
        }

        const rawPic = item.cover || item.pic || '';
        // Fix HTTP to HTTPS to avoid mixed content
        const coverUrl = rawPic.startsWith('//') ? `https:${rawPic}` : (rawPic.startsWith('http:') ? rawPic.replace('http:', 'https:') : rawPic);
        
        const vidId = item.bvid || item.param || item.aid?.toString() || '';

        return {
            id: vidId,
            title: item.title || '',
            coverUrl,
            createTime: (item.ctime || item.created || 0) * 1000, // B站 created/ctime 是秒级时间戳
            duration: durationMs,
            platform: 'B站',
            author: {
                id: item.mid?.toString() || uid,
                nickname: item.author || 'B站用户',
                avatar: ''
            },
            stats: {
                playCount: item.play || item.view || item.stat?.view || 0,
                likeCount: item.like || item.stat?.like || item.favorites || item.stat?.favorite || 0, 
                commentCount: item.reply || item.comment || item.danmaku || item.stat?.reply || item.stat?.danmaku || 0,
                collectCount: item.stow || item.favorites || item.collect || item.stat?.favorite || item.stat?.coin || 0,
                shareCount: item.share || item.video_review || item.stat?.share || 0 
            }
        };
    });

    const currentPg = typeof page === 'string' ? parseInt(page) : page;
    const hasMore = items.length >= 20;

    return {
        videos,
        nextCursor: hasMore ? currentPg + 1 : null,
        hasMore
    };
}
