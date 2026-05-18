import { storage } from '../storage';
import { FetchVideosResult, UnifiedUserProfile, UnifiedVideo } from './types';

async function getApiKey(): Promise<string> {
    const key = await storage.get<string>('tikhub_api_key');
    if (!key) throw new Error('API Key 未配置，请先在右上角【设置/API】中配置 TikHub API Key。');
    return key;
}

/**
 * 微博数据解析器
 * 专门处理微博 Web V2 接口返回的复杂嵌套结构
 */
function parseWeiboUserProfile(data: any, originalId: string): UnifiedUserProfile {
    const actualData = data.data || data;
    console.log('Weibo Raw Payload (Profile):', actualData);
    
    // 优先从 actualData.data 提取 (Weibo Basic Info 结构)
    // 其次检查 data.user (Weibo Video List 结构)
    // 最后检查 data.list[0]?.user (真实存放地)
    const user = actualData.data || actualData.user || actualData.list?.[0]?.user || (actualData.screen_name ? actualData : null);
    
    if (!user) {
        console.error('Weibo user object not found in payload. Available keys:', Object.keys(actualData || {}));
        return {
            platform: '微博',
            id: originalId,
            nickname: 'Unknown Blogger',
            avatar: '',
            signature: '',
            followerCount: 0,
            likeCount: 0,
            videoCount: 0,
            ipLocation: ''
        };
    }

    console.log('Weibo Mapping User:', { screen_name: user.screen_name, id: user.idstr || user.id });

    const nickname = user.screen_name || user.name || 'AMFLOW 安流';
    const avatar = user.avatar_hd || user.avatar || user.profile_image_url || '';
    
    // 互动数据提取
    const stats = user.status_total_counter || {};
    
    const parseFormattedNumber = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let clean = String(val).replace(/,/g, '');
        // 增加对中文单位“万”的支持
        if (clean.includes('万')) {
            return Math.floor(parseFloat(clean.replace('万', '')) * 10000);
        }
        return parseInt(clean) || 0;
    };

    const followerCount = parseFormattedNumber(user.followers_count || user.followers_count_str);
    const likeCount = parseFormattedNumber(stats.like_cnt);

    return {
        platform: '微博',
        id: (user.idstr || user.id || originalId)?.toString() || '',
        nickname,
        avatar,
        signature: user.descText || user.description || '',
        followerCount,
        likeCount, 
        videoCount: user.statuses_count || 0,
        ipLocation: user.location || ''
    };
}

function parseWeiboVideos(data: any, cursor: string | number): FetchVideosResult {
    const actualData = data.data || data;
    const items = actualData.list || actualData.statuses || actualData.cards || [];
    
    if (items.length === 0) {
        console.warn('微博作品列表为空。原始 result.data 键位:', Object.keys(actualData || {}));
    }

    let coverCount = 0;

    const videos: UnifiedVideo[] = items.map((item: any) => {
        const status = item.status || item.mblog || item;
        const pageInfo = status.page_info || {};
        
        // 关键：封面图深度搜索逻辑重构
        // 优先检查 item.page_info?.page_pic?.url
        let coverUrl = pageInfo.page_pic?.url || pageInfo.video_info?.cover_url || '';
        
        if (!coverUrl && status.pic_contents && status.pic_contents.length > 0) {
            coverUrl = status.pic_contents[0]?.data?.url || status.pic_contents[0]?.pic_url || '';
        }

        if (!coverUrl && status.pic_infos) {
             const keys = Object.keys(status.pic_infos);
             if (keys.length > 0) {
                 const firstPic = status.pic_infos[keys[0]];
                 coverUrl = firstPic.large?.url || firstPic.mw2000?.url || firstPic.bmiddle?.url || '';
             }
        }

        if (!coverUrl && status.thumbnail_pic) coverUrl = status.thumbnail_pic;
        
        if (coverUrl) coverCount++;

        const dateStr = status.created_at; // Example: "Wed Apr 29 19:00:01 +0800 2026"
        let createTime = Math.floor(Date.now() / 1000);
        if (dateStr) {
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
                createTime = Math.floor(dateObj.getTime() / 1000);
            }
        }

        const rawIdStr = status.idstr || status.id || status.mid || '';
        const rawMid = status.mid || status.idstr || status.id || '';
        // If idstr contains ':', it's an OID. Prefer mid.
        const vidId = rawIdStr.includes(':') ? (status.mid || status.id || rawIdStr) : rawMid;
        
        const user = status.user || {};
        return {
            id: String(vidId),
            title: status.text_raw || status.text || '',
            coverUrl,
            createTime,
            duration: pageInfo.media_info?.duration ? Math.floor(parseFloat(pageInfo.media_info.duration) * 1000) : 0,
            platform: '微博',
            author: {
                id: user.idstr || user.id || '',
                nickname: user.screen_name || user.name || 'Unknown',
                avatar: user.avatar_hd || user.profile_image_url || ''
            },
            stats: {
                likeCount: status.attitudes_count || 0,
                commentCount: status.comments_count || 0,
                collectCount: status.reposts_count || 0, 
                shareCount: status.reposts_count || 0,
                playCount: pageInfo.media_info?.play_count || 0
            }
        };
    });

    console.log(`微博博主：[${videos[0]?.author.nickname || 'Unknown'}] 解析成功，抓取到 ${coverCount} 个帖子封面。`);

    const hasMore = actualData.has_more ?? (items.length > 0); 
    const nextCursor = actualData.next_cursor || actualData.page || (String(cursor) !== '0' ? parseInt(String(cursor)) + 1 : 2);

    return {
        videos,
        hasMore,
        nextCursor
    };
}

function extractWeiboUid(input: string): string {
    if (!input) return '';
    const cleanInput = input.trim();
    const match = cleanInput.match(/\/(u|profile)\/(\d+)/);
    if (match && match[2]) return match[2];
    return cleanInput.replace(/https?:\/\/[^\s]+/, '').trim() || cleanInput;
}

export async function fetchWeiboHashtagProfile(query: string): Promise<UnifiedUserProfile> {
    const cleanTopic = query.trim().replace(/^#/, '').replace(/#$/, '');
    if (!cleanTopic) throw new Error('无效的微博话题关键词');
    
    return {
        platform: '微博',
        id: cleanTopic,
        nickname: `#${cleanTopic}`, // Only show topic name with #
        avatar: '', 
        signature: '微博话题搜索结果',
        followerCount: 0,
        likeCount: 0,
        videoCount: 0,
    };
}

export async function fetchWeiboHashtagVideos(keyword: string, cursor: string | number = '1', sortType: number = 0): Promise<FetchVideosResult> {
    const apiKey = await getApiKey();
    const cleanKeyword = keyword.trim().replace(/^#/, '').replace(/#$/, '');
    
    const params = new URLSearchParams();
    params.append('query', cleanKeyword);
    params.append('search_type', '64'); // Specified by user
    params.append('page', String(cursor === '0' || cursor === 0 ? 1 : cursor));
    
    const finalUrl = `/api/tikhub/api/v1/weibo/app/fetch_search_all?${params.toString()}`;
    
    console.log('Fetching Weibo Search:', finalUrl);
    
    const res = await fetch(finalUrl, { 
        headers: { 
            'Authorization': `Bearer ${apiKey}`, 
            'Accept': 'application/json' 
        }
    });
    
    if (!res.ok) {
        throw new Error(`微博搜索失败 (${res.status})`);
    }
    
    const data = await res.json();
    const itemsContainer = data.data?.cards || data.data?.items || data.cards || [];
    
    // Some Weibo search APIs return items directly in data.items or data.cards
    // The user's JSON showed:
    // { "type": "vertical", "items": [...] }
    // which might be part of a larger object.
    
    let rawItems: any[] = [];
    if (Array.isArray(itemsContainer)) {
        rawItems = itemsContainer;
    } else if (itemsContainer.items && Array.isArray(itemsContainer.items)) {
        rawItems = itemsContainer.items;
    }

    const videos: UnifiedVideo[] = [];
    
    rawItems.forEach((item: any) => {
        // Handle items from user snippet structure
        const status = item.data || (item.category === 'feed' ? item.data : null);
        if (!status || status.card_type === 42) return; // Skip headers

        const pageInfo = status.page_info || {};
        
        // Find cover
        let coverUrl = pageInfo.page_pic?.url || pageInfo.video_info?.cover_url || '';
        if (!coverUrl && status.pic_ids && status.pic_ids.length > 0 && status.pic_infos) {
            const firstPic = status.pic_infos[status.pic_ids[0]];
            coverUrl = firstPic.large?.url || firstPic.mw2000?.url || firstPic.bmiddle?.url || '';
        }
        if (!coverUrl && status.thumbnail_pic) coverUrl = status.thumbnail_pic;

        // Date
        let createTime = Math.floor(Date.now() / 1000);
        if (status.created_at) {
            const dateObj = new Date(status.created_at);
            if (!isNaN(dateObj.getTime())) {
                createTime = Math.floor(dateObj.getTime() / 1000);
            }
        }

        const user = status.user || {};
        
        videos.push({
            id: status.idstr || status.id || status.mid || '',
            title: status.text || '',
            coverUrl,
            createTime,
            duration: pageInfo.video_info?.duration ? Math.floor(parseFloat(pageInfo.video_info.duration) * 1000) : 0,
            platform: '微博',
            author: {
                id: (user.idstr || user.id || '').toString(),
                nickname: user.screen_name || user.name || 'Unknown',
                avatar: user.avatar_hd || user.avatar_large || user.profile_image_url || ''
            },
            stats: {
                likeCount: status.attitudes_count || 0,
                commentCount: status.comments_count || 0,
                collectCount: status.reposts_count || 0,
                shareCount: status.reposts_count || 0,
                playCount: pageInfo.video_info?.play_count || 0
            }
        });
    });

    const nextCursor = (parseInt(String(cursor)) || 1) + 1;

    return {
        videos,
        hasMore: videos.length > 0,
        nextCursor: String(nextCursor)
    };
}

export async function fetchWeiboUserProfile(query: string): Promise<UnifiedUserProfile> {
    const apiKey = await getApiKey();
    const uid = extractWeiboUid(query);
    if (!uid) throw new Error('无效的微博用户链接或ID');
    const params = new URLSearchParams();
    params.append('uid', uid);

    const finalUrl = `/api/tikhub/api/v1/weibo/web_v2/fetch_user_basic_info?${params.toString()}`;
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    
    if (!res.ok) {
        let errText = '';
        try { errText = await res.text(); } catch(e) {}
        throw new Error(`微博请求失败 (${res.status}) ${errText}`);
    }
    
    const data = await res.json();
    return parseWeiboUserProfile(data, uid);
}

export async function fetchWeiboVideos(uid: string, cursor: string = '0', sortType: number = 0): Promise<FetchVideosResult> {
    const apiKey = await getApiKey();
    const cleanId = String(uid).trim();
    const params = new URLSearchParams();
    params.append('uid', cleanId);
    
    // 使用 cursor 进行翻页
    const currentCursor = (cursor === '' || cursor === undefined || String(cursor) === '0') ? '0' : String(cursor);
    params.append('cursor', currentCursor);
    
    const finalUrl = `/api/tikhub/api/v1/weibo/web_v2/fetch_user_video_list?${params.toString()}`;
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    
    if (!res.ok) {
        let errText = '';
        try { errText = await res.text(); } catch(e) {}
        throw new Error(`微博请求失败 (${res.status}) ${errText}`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.code !== 0 && data.status_code !== 0) {
       throw new Error(data.msg || data.message || '获取视频列表失败');
    }

    return parseWeiboVideos(data, cursor);
}

export async function fetchWeiboVideoComments(mid: string, cursor: string = '', count: number = 20) {
    const apiKey = await getApiKey();
    const cleanId = String(mid).trim();
    const params = new URLSearchParams();
    params.append('status_id', cleanId);
    
    // We assume there might be a cursor string or pagination for Weibo
    if (cursor && cursor !== '0') {
        params.append('max_id', cursor); // typically Weibo uses max_id for comments pagination
    }
    
    const finalUrl = `/api/tikhub/api/v1/weibo/app/fetch_status_comments?${params.toString()}`;
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    
    if (!res.ok) {
        let errText = '';
        try { errText = await res.text(); } catch(e) {}
        throw new Error(`微博评论请求失败 (${res.status}) ${errText}`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.code !== 0 && data.status_code !== 0) {
       throw new Error(data.msg || data.message || '获取评论列表失败');
    }

    const actualData = data.data || data;
    
    // Auto-detect the comment array
    let commentsArray: any[] = [];
    
    // Deep search function to find the first array that contains comment-like objects
    function findCommentsArray(obj: any, depth = 0): any[] | null {
        if (depth > 4 || !obj) return null; // limit depth
        if (Array.isArray(obj)) {
            // Check if it looks like a list of comments
            if (obj.length > 0 && (obj[0].text_raw || obj[0].text || obj[0].created_at || (obj[0].user && obj[0].user.name))) {
                return obj;
            }
            return null;
        }
        if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                if (Array.isArray(obj[key])) {
                     if (obj[key].length > 0 && (obj[key][0].text_raw || obj[key][0].text || obj[key][0].created_at || (obj[key][0].user && obj[key][0].user.name))) {
                         return obj[key];
                     }
                }
            }
            for (const key of Object.keys(obj)) {
               const res = findCommentsArray(obj[key], depth + 1);
               if (res) return res;
            }
        }
        return null;
    }

    commentsArray = findCommentsArray(actualData) || [];

    // Fallbacks if auto-detect failed
    if (!commentsArray.length) {
        commentsArray = actualData.root_comments || actualData.comments || actualData.data || actualData.list || actualData.items || [];
        if (!Array.isArray(commentsArray)) commentsArray = [];
    }

    return {
        comments: commentsArray.map((c: any) => ({
            id: c.id?.toString() || '',
            text: c.text_raw || c.text || '',
            likeCount: c.like_counts || c.likes || 0,
            createTime: c.created_at ? Math.floor(new Date(c.created_at).getTime() / 1000) : 0,
            author: c.user?.screen_name || c.user?.name || ''
        })),
        hasMore: actualData.max_id && actualData.max_id !== 0,
        nextCursor: actualData.max_id?.toString() || ''
    };
}
