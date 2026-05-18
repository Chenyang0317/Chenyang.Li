import { storage } from '../storage';
import { FetchVideosResult, UnifiedUserProfile, UnifiedVideo } from './types';

async function getApiKey(): Promise<string> {
    const key = await storage.get<string>('tikhub_api_key');
    if (!key) throw new Error('API Key 未配置，请先在右上角【设置/API】中配置 TikHub API Key。');
    return key;
}

/**
 * 小红书数据解析器
 */
function parseXiaohongshuUserProfile(data: any, originalId: string): UnifiedUserProfile {
    const actualData = data.data?.data || data.data || data;
    const userInfo = actualData.user_info || actualData;
    const basicInfo = actualData.basicInfo || userInfo.basic_info || actualData.basic_info || {};
    
    const nickname = basicInfo.nickname || userInfo.nickname || userInfo.nickName || userInfo.name || 'Unknown';
    const avatar = basicInfo.images || basicInfo.imageb || userInfo.imageb || userInfo.images || userInfo.avatar || '';
    const extractedId = basicInfo.redId || basicInfo.red_id || userInfo.userid || userInfo.user_id || userInfo.redId || originalId;
    const signature = basicInfo.desc || userInfo.desc || userInfo.signature || '';
    const ipLocation = basicInfo.ipLocation || basicInfo.ip_location || userInfo.ip_location || userInfo.location || '';

    let followerCount = 0;
    let likeCount = 0;
    const interactions = userInfo.interactions || [];
    
    if (Array.isArray(interactions)) {
        const fans = interactions.find((i: any) => i.type === 'fans' || i.name === '粉丝')?.count || '0';
        followerCount = typeof fans === 'number' ? fans : parseInt(String(fans).replace(/,/g, '')) || 0;

        // 适配 type: 'interaction' 的获赞与收藏
        const likes = interactions.find((i: any) => i.type === 'interaction' || i.type === 'collected' || i.name === '获赞与收藏')?.count || '0';
        likeCount = typeof likes === 'number' ? likes : parseInt(String(likes).replace(/,/g, '')) || 0;
    }

    // 优化作品数探测：支持更多字段名和语义匹配
    const notesInteraction = Array.isArray(interactions) 
        ? interactions.find((i: any) => i.type === 'notes' || i.name === '笔记' || i.name === '作品' || i.name === '笔记数')
        : null;
    
    const notesCountRaw = userInfo.notes || userInfo.note_count || userInfo.notes_count || userInfo.noteCount || userInfo.notesCount || 
                         actualData.notes || actualData.note_count || actualData.notes_count || actualData.noteCount || actualData.notesCount ||
                         notesInteraction?.count || '0';
    
    const videoCount = typeof notesCountRaw === 'number' ? notesCountRaw : parseInt(String(notesCountRaw).replace(/,/g, '')) || 0;

    const targetId = actualData.user_id || actualData.userId || userInfo.user_id || userInfo.userId || userInfo.userid || extractedId;

    return {
        platform: '小红书',
        id: targetId ? targetId.toString() : '',
        nickname,
        avatar: avatar.startsWith('//') ? `https:${avatar}` : avatar,
        signature,
        followerCount,
        likeCount,
        videoCount,
        ipLocation: ipLocation || ''
    };
}

function parseCNNum(val: any): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).toLowerCase().replace(/,/g, '').trim();
    let multiplier = 1;
    if (str.includes('万') || str.includes('w')) {
        multiplier = 10000;
        str = str.replace(/万|w/g, '');
    } else if (str.includes('k')) {
        multiplier = 1000;
        str = str.replace(/k/g, '');
    }
    const numMatch = str.match(/[\d.]+/);
    if (numMatch) {
        return Math.floor(parseFloat(numMatch[0]) * multiplier);
    }
    return 0;
}

function parseXiaohongshuVideos(data: any): FetchVideosResult {
    const actualData = data.data?.data || data.data || data;
    
    let items: any[] = [];
    
    // Auto-detect array
    function findNotesArray(obj: any, depth = 0): any[] | null {
        if (depth > 4 || !obj) return null;
        if (Array.isArray(obj)) {
            if (obj.length > 0 && (obj[0].note_card || obj[0].noteCard || obj[0].note_id || obj[0].noteId || obj[0].display_title)) {
                return obj;
            }
            return null;
        }
        if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                if (Array.isArray(obj[key])) {
                     if (obj[key].length > 0 && (obj[key][0].note_card || obj[key][0].noteCard || obj[key][0].note_id || obj[key][0].noteId || obj[key][0].display_title)) {
                         return obj[key];
                     }
                }
            }
            for (const key of Object.keys(obj)) {
               const res = findNotesArray(obj[key], depth + 1);
               if (res) return res;
            }
        }
        return null;
    }

    items = findNotesArray(actualData) || [];

    if (!items.length) {
        if (Array.isArray(actualData)) {
            items = actualData;
        } else {
            items = actualData?.notes || actualData?.items || actualData?.list || actualData?.cards || actualData?.note_list || [];
        }
    }
    
    let validItems = items.filter((item: any) => {
        if (!item) return false;
        const nc = item.note_card || item.noteCard || item;
        const id = nc.id || nc.note_id || nc.noteId || item.note_id || item.noteId || item.id;
        return !!id;
    });

    const seen = new Set();
    validItems = validItems.filter((item: any) => {
        const nc = item.note_card || item.noteCard || item;
        const id = nc.id || nc.note_id || nc.noteId || item.note_id || item.noteId || item.id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    const videos: UnifiedVideo[] = validItems.map((item: any, index: number) => {
        const noteCard = item.note_card || item.noteCard || item;
        
        // 封面图逻辑优化：优先寻找 infoList 中的高质量图
        let coverUrl = noteCard.cover?.urlDefault || noteCard.cover?.urlPre || noteCard.cover?.url || noteCard.images_list?.[0]?.url || noteCard.image_list?.[0]?.url || noteCard.imageList?.[0]?.url || '';
        if (noteCard.cover?.infoList && noteCard.cover.infoList.length > 0) {
            const dftImage = noteCard.cover.infoList.find((img: any) => img.imageScene === 'WB_DFT');
            if (dftImage) coverUrl = dftImage.url;
            else coverUrl = noteCard.cover.infoList[0].url;
        } else if (noteCard.cover?.info_list && noteCard.cover.info_list.length > 0) {
            const dftImage = noteCard.cover.info_list.find((img: any) => img.image_scene === 'WB_DFT' || img.imageScene === 'WB_DFT');
            if (dftImage) coverUrl = dftImage.url;
            else coverUrl = noteCard.cover.info_list[0].url;
        }

        const finalCoverUrl = coverUrl.startsWith('//') ? `https:${coverUrl}` : coverUrl;
        
        const interact = noteCard.interactInfo || noteCard.interact_info || {};

        // 点赞数转换
        const likedCount = interact.likedCount || interact.liked_count || noteCard.likes || '0';
        const likeCountNum = parseCNNum(likedCount);

        const commentCountRaw = interact.commentCount || interact.comment_count || noteCard.comments || '0';
        const collectCountRaw = interact.collectedCount || interact.collected_count || noteCard.collects || '0';
        const shareCountRaw = interact.sharedCount || interact.shared_count || noteCard.shares || '0';

        const cNum = parseCNNum(commentCountRaw);
        const colNum = parseCNNum(collectCountRaw);
        const sNum = parseCNNum(shareCountRaw);

        const videoId = String(noteCard.note_id || noteCard.noteId || noteCard.id || item.note_id || item.noteId || item.id || `temp-${index}-${Date.now()}-${Math.floor(Math.random()*1000)}`);

        return {
            id: videoId,
            title: noteCard.displayTitle || noteCard.title || noteCard.display_title || noteCard.desc || '',
            coverUrl: finalCoverUrl,
            createTime: noteCard.time || noteCard.timestamp || Math.floor(Date.now() / 1000),
            duration: noteCard.video?.duration || 0,
            platform: '小红书',
            author: {
                id: noteCard.user?.userId || noteCard.user?.userid || noteCard.user?.user_id || '',
                nickname: noteCard.user?.nickname || noteCard.user?.nickName || noteCard.user?.name || '',
                avatar: noteCard.user?.avatar || noteCard.user?.image || ''
            },
            stats: {
                likeCount: likeCountNum,
                commentCount: cNum,
                collectCount: colNum,
                shareCount: sNum,
                playCount: parseCNNum(noteCard.views || 0)
            }
        };
    });

    const nextCursor = actualData.cursor || (items.length > 0 ? (items[items.length - 1].cursor || items[items.length - 1].noteId || items[items.length - 1].note_id || items[items.length - 1].id) : '') || '';

    return {
        videos,
        hasMore: actualData.has_more === true || actualData.has_more === 1 || !!nextCursor,
        nextCursor: String(nextCursor)
    };
}

export async function fetchXiaohongshuUserProfile(userId: string): Promise<UnifiedUserProfile> {
    const apiKey = await getApiKey();
    const cleanId = String(userId).replace(/\s+/g, ' ').trim();
    const isUrl = /(https?:\/\/[^\s]+)|(小红书)/i.test(cleanId);
    
    const params = new URLSearchParams();
    if (isUrl) {
        params.append('share_text', cleanId);
    } else {
        params.append('user_id', cleanId);
    }

    const finalUrl = `/api/tikhub/api/v1/xiaohongshu/app_v2/get_user_info?${params.toString()}`;
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    
    if (!res.ok) {
        let errText = '';
        try { errText = await res.text(); } catch(e) {}
        throw new Error(`小红书主页请求失败 (${res.status}) ${errText}`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.code !== 0 && data.status_code !== 0) {
        throw new Error(data.msg || data.message || '获取博主信息失败');
    }

    return parseXiaohongshuUserProfile(data, cleanId);
}

export async function fetchXiaohongshuVideos(userId: string, cursor: string = '', sortType: number = 0): Promise<FetchVideosResult> {
    const apiKey = await getApiKey();
    let cleanId = String(userId).replace(/\s+/g, ' ').trim();
    const isUrl = /(https?:\/\/[^\s]+)|(小红书)/i.test(cleanId);
    
    const params = new URLSearchParams();
    if (isUrl) {
        params.append('share_text', cleanId);
    } else {
        params.append('user_id', cleanId);
    }
    
    // Some tikub API endpoints fail if unsupported parameters like count are provided
    if (cursor && cursor !== '0') {
        params.append('cursor', cursor);
    } else {
        params.append('cursor', '');
    }
    
    const finalUrl = `/api/tikhub/api/v1/xiaohongshu/app_v2/get_user_posted_notes?${params.toString()}`;
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    
    if (!res.ok) {
        let errText = '';
        try { errText = await res.text(); } catch(e) {}
        throw new Error(`小红书视频请求失败 (${res.status}) ${errText}`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.code !== 0 && data.status_code !== 0) {
       throw new Error(data.msg || data.message || '获取笔记列表失败');
    }

    return parseXiaohongshuVideos(data);
}

export async function fetchXiaohongshuVideoComments(noteId: string, cursor: string = '', count: number = 20) {
    const apiKey = await getApiKey();
    const cleanId = String(noteId).trim();
    
    const params = new URLSearchParams();
    params.append('note_id', cleanId);
    if (cursor && cursor !== '0') {
        params.append('lastCursor', cursor);
    }
    
    // Use the web endpoint
    const finalUrl = `/api/tikhub/api/v1/xiaohongshu/web/get_note_comments?${params.toString()}`;
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    
    if (!res.ok) {
        let errText = '';
        try { errText = await res.text(); } catch(e) {}
        throw new Error(`小红书请求失败 (${res.status}) ${errText}`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.code !== 0 && data.status_code !== 0) {
       throw new Error(data.msg || data.message || '获取评论列表失败');
    }

    const actualData = data.data?.data || data.data || data;
    const comments = actualData.comments || [];
    
    return {
        comments: comments.map((c: any, index: number) => ({
            id: String(c.id || c.comment_id || `comment-${index}-${Date.now()}`),
            text: c.content || c.text || '',
            likeCount: c.like_count || c.likes || 0,
            createTime: c.create_time || c.time || 0,
            author: c.user_info?.nickname || c.user?.nickname || ''
        })),
        hasMore: actualData.has_more === true || actualData.has_more === 1 || comments.length >= 20 || !!actualData.cursor,
        nextCursor: actualData.cursor || ''
    };
}

export async function fetchXiaohongshuHashtagProfile(keyword: string): Promise<UnifiedUserProfile> {
    return {
        platform: '小红书',
        id: keyword,
        nickname: `#${keyword}#`,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(keyword)}&background=random&color=fff`,
        signature: '小红书话题搜索',
        followerCount: 0,
        likeCount: 0,
        videoCount: 0,
        ipLocation: ''
    };
}

export async function fetchXiaohongshuHashtagVideos(keyword: string, cursor: string = '', sortType: number = 0): Promise<FetchVideosResult> {
    const apiKey = await getApiKey();
    const cleanKeyword = String(keyword).trim();
    
    // sortType can be mapped if Tikhub supports it. Usually: 
    // sortType 0 -> default (general)
    // sortType 1 -> latest (time_descending)
    // sortType 2 -> hottest (popularity_descending)
    const sortParams = ['general', 'time_descending', 'popularity_descending'];
    const sortVal = sortParams[sortType] || 'general';

    const params = new URLSearchParams();
    params.append('keyword', cleanKeyword);
    params.append('sort_type', sortVal);
    params.append('note_type', '不限'); // '全部' maybe is un-restricted? We can just leave out the search options that are optional
    
    const page = cursor === '' || cursor === '0' ? 1 : Number(cursor) || 1;
    params.append('page', String(page));
    
    // search_id and search_session_id would theoretically be passed as cursors if we were extracting them,
    // but for now page number should be enough for basic app_v2/search_notes since we just increment cursor as a stringified page.
    
    const finalUrl = `/api/tikhub/api/v1/xiaohongshu/app_v2/search_notes?${params.toString()}`;
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    
    if (!res.ok) {
        let errText = '';
        try { errText = await res.text(); } catch(e) {}
        throw new Error(`小红书搜索请求失败 (${res.status}) ${errText}`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.code !== 0 && data.status_code !== 0) {
       throw new Error(data.msg || data.message || '获取话题笔记失败');
    }

    const parsed = parseXiaohongshuVideos(data);
    const actualData = data.data?.data || data.data || data;
    const items = actualData.notes || actualData.items || [];
    
    const hasMore = actualData.has_more === true || actualData.has_more === 1 || items.length >= 20;
    
    return {
        videos: parsed.videos,
        hasMore: hasMore,
        nextCursor: hasMore ? String(page + 1) : ''
    };
}
