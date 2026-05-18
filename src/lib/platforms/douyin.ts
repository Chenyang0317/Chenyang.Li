import { storage } from '../storage';
import { FetchVideosResult, UnifiedUserProfile, UnifiedVideo } from './types';

const API_BASE = '/api/tikhub';

async function getApiKey(): Promise<string> {
    const key = await storage.get<string>('tikhub_api_key');
    if (!key) throw new Error('API Key 未配置，请先在右上角【设置/API】中配置 TikHub API Key。');
    return key;
}

function extractSecUserId(input: string): string {
    if (!input) return '';
    let cleanInput = input.replace(/https?:\/\/[^\s]+/, '').trim();
    if (!cleanInput) cleanInput = input.trim();
    
    const match = cleanInput.match(/user\/([^?\/]+)/) || input.match(/user\/([^?\/]+)/);
    if (match && match[1]) return match[1];
    
    try {
        const url = new URL(input);
        const parts = url.pathname.split('/');
        if (parts.length >= 3 && parts[1] === 'user') return parts[2];
    } catch (e) {}
    return cleanInput;
}

/**
 * 抖音数据解析器
 */
function parseDouyinUserProfile(data: any): UnifiedUserProfile {
    const user = (data.data || data).user || (data.data || data);

    return {
        platform: '抖音',
        id: user.sec_uid || user.sec_user_id || '',
        nickname: user.nickname || 'Unknown',
        avatar: user.avatar_larger?.url_list?.[0] || 
                user.avatar_medium?.url_list?.[0] || 
                user.avatar_300x300?.url_list?.[0] || 
                user.avatar_168x168?.url_list?.[0] || 
                user.avatar_thumb?.url_list?.[0] || '',
        signature: user.signature || '',
        followerCount: user.follower_count || 0,
        likeCount: user.total_favorited || 0,
        videoCount: user.aweme_count || 0,
        ipLocation: user.ip_location
    };
}

function parseDouyinSearchVideos(data: any): FetchVideosResult {
    const actualData = data.data || data;
    // For search v2, items are in business_data. For v1, items are in data or aweme_list.
    const items = actualData.business_data || actualData.data || actualData.aweme_list || [];

    const videos: UnifiedVideo[] = [];
    
    for (const item of items) {
        // v2 structure: item.data.aweme_info
        // v1 structure: item.aweme_info or item
        let aweme = null;
        if (item.data && item.data.aweme_info) {
            aweme = item.data.aweme_info;
        } else if (item.aweme_info) {
            aweme = item.aweme_info;
        } else if (item.aweme_id) {
            aweme = item;
        }

        if (!aweme || !aweme.aweme_id) continue;
        
        videos.push({
            id: aweme.aweme_id,
            title: aweme.desc || '',
            coverUrl: aweme.video?.cover?.url_list?.[0] || aweme.video?.origin_cover?.url_list?.[0] || '',
            videoUrl: aweme.video?.play_addr?.url_list?.[0] || '',
            createTime: aweme.create_time || 0,
            duration: aweme.video?.duration || 0,
            platform: '抖音',
            author: {
                id: aweme.author?.sec_uid || '',
                nickname: aweme.author?.nickname || '',
                avatar: aweme.author?.avatar_thumb?.url_list?.[0] || ''
            },
            stats: {
                likeCount: aweme.statistics?.digg_count || 0,
                commentCount: aweme.statistics?.comment_count || 0,
                collectCount: aweme.statistics?.collect_count || 0,
                shareCount: aweme.statistics?.share_count || 0,
                playCount: aweme.statistics?.play_count || 
                           aweme.statistics?.view_count || 
                           aweme.statistics?.forward_count || // Sometimes used as a broad exposure metric
                           aweme.play_count || 
                           aweme.view_count || 
                           aweme.cell_info?.view_count || 
                           0
            }
        });
    }

    return {
        videos,
        hasMore: actualData.has_more === 1 || actualData.has_more === true,
        nextCursor: actualData.cursor || actualData.max_cursor || 0
    };
}

export async function fetchDouyinHashtagVideos(keyword: string, cursor: number | string = 0, sortType: number = 0, publishTime: number = 0): Promise<FetchVideosResult> {
    const apiKey = await getApiKey();
    
    // Clean keyword if it contains "#" or URL
    let cleanKeyword = keyword;
    if (cleanKeyword.includes('hashtag/')) {
       // if it's a URL, extract the word or ID
       const match = cleanKeyword.match(/hashtag\/([^?\/]+)/);
       if (match && match[1]) cleanKeyword = decodeURIComponent(match[1]);
    }
    // If it starts with "#", remove it
    if (cleanKeyword.startsWith('#')) {
       cleanKeyword = cleanKeyword.substring(1);
    }
    
    const finalUrl = `/api/tikhub/api/v1/douyin/search/fetch_video_search_v2`;
    
    const fetchPage = async (pageCursor: number | string): Promise<FetchVideosResult> => {
        const res = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`, 
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                keyword: cleanKeyword,
                cursor: Number(pageCursor) || 0,
                sort_type: "1", // Hardcoded to 1 as requested
                publish_time: String(publishTime),
                filter_duration: "0",
                content_type: "0",
                search_id: "",
                backtrace: ""
            })
        });
        
        if (!res.ok) {
            let errDesc = '';
            try {
                const errObj = await res.json();
                errDesc = JSON.stringify(errObj);
            } catch(e) {
                errDesc = await res.text();
            }
            throw new Error(`抖音搜索请求失败 (${res.status}): ${errDesc}`);
        }
        
        const data = await res.json();
        if (data.code !== 200 && data.status_code !== 0 && data.code !== 0) {
           throw new Error(data.msg || data.message || '获取搜索视频列表失败');
        }

        return parseDouyinSearchVideos(data);
    };

    // Initial fetch
    let result = await fetchPage(cursor);
    
    // If we have very few videos and there's more, try to fetch one more page to reach a better quantity (e.g. 20+)
    // Only do this for the first page (cursor=0) to avoid excessive API calls
    if (cursor === 0 && result.videos.length < 15 && result.hasMore) {
        try {
            const nextPage = await fetchPage(result.nextCursor);
            result.videos = [...result.videos, ...nextPage.videos];
            result.nextCursor = nextPage.nextCursor;
            result.hasMore = nextPage.hasMore;
        } catch (e) {
            console.error('Failed to auto-fetch second page:', e);
            // We just return what we have
        }
    }

    return result;
}

function parseDouyinVideos(data: any): FetchVideosResult {
    const actualData = data.data || data;
    const items = actualData.aweme_list || [];

    const videos: UnifiedVideo[] = items.map((item: any) => ({
        id: item.aweme_id,
        title: item.desc || '',
        coverUrl: item.video?.cover?.url_list?.[0] || item.video?.origin_cover?.url_list?.[0] || '',
        videoUrl: item.video?.play_addr?.url_list?.[0] || '',
        createTime: item.create_time || 0,
        duration: item.video?.duration || 0,
        platform: '抖音',
        author: {
            id: item.author?.sec_uid || '',
            nickname: item.author?.nickname || '',
            avatar: item.author?.avatar_thumb?.url_list?.[0] || ''
        },
        stats: {
            likeCount: item.statistics?.digg_count || 0,
            commentCount: item.statistics?.comment_count || 0,
            collectCount: item.statistics?.collect_count || 0,
            shareCount: item.statistics?.share_count || 0,
            playCount: item.statistics?.play_count || 
                       item.statistics?.view_count || 
                       item.play_count || 
                       item.view_count || 
                       0
        }
    }));

    return {
        videos,
        hasMore: actualData.has_more === 1 || actualData.has_more === true,
        nextCursor: actualData.max_cursor || 0
    };
}

export async function fetchDouyinUserProfile(query: string): Promise<UnifiedUserProfile> {
    const apiKey = await getApiKey();
    const secUserId = extractSecUserId(query);
    if (!secUserId) throw new Error('无效的抖音用户链接或ID');
    
    const finalUrl = `/api/tikhub/api/v1/douyin/app/v3/handler_user_profile?sec_user_id=${secUserId}`;
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    
    if (!res.ok) {
        throw new Error(`抖音请求失败 (${res.status})`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.status_code !== 0 && data.code !== 0) {
        throw new Error(data.msg || data.message || '获取博主信息失败');
    }

    return parseDouyinUserProfile(data);
}

function extractHashtagId(input: string): string {
    if (!input) return '';
    let cleanInput = input.replace(/https?:\/\/[^\s]+/, '').trim();
    if (!cleanInput) cleanInput = input.trim();
    
    // Check for explicit hashtag ID in URL
    const match = cleanInput.match(/hashtag\/([^?\/]+)/) || input.match(/hashtag\/([^?\/]+)/);
    if (match && match[1]) return match[1];
    
    // Just return the straight numbers if it looks like an ID
    if (/^\d+$/.test(cleanInput)) return cleanInput;
    
    // Else return the query text, assuming backend might search by text if supported, but typically we need ID.
    return cleanInput;
}

export async function fetchDouyinHashtagProfile(query: string): Promise<UnifiedUserProfile> {
    const apiKey = await getApiKey();
    const chId = extractHashtagId(query);
    if (!chId) throw new Error('无效的抖音话题链接或ID');
    
    // If the chId is completely numeric, try fetching hashtag details
    if (/^\d+$/.test(chId)) {
        const finalUrl = `/api/tikhub/api/v1/douyin/app/v3/fetch_hashtag_detail?ch_id=${chId}`;
        const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
        
        if (res.ok) {
            const data = await res.json();
            if (data.code === 200 || data.status_code === 0 || data.code === 0) {
                const chInfo = data.data?.ch_info || data.ch_info || {};
                return {
                    platform: '抖音',
                    id: chId, // we keep the ID for the video search payload
                    nickname: chInfo.cha_name ? `#${chInfo.cha_name}` : '未知话题',
                    avatar: chInfo.author?.avatar_larger?.url_list?.[0] || chInfo.author?.avatar_medium?.url_list?.[0] || '',
                    signature: chInfo.desc || chInfo.author?.signature || '该话题暂无简介',
                    followerCount: chInfo.view_count || chInfo.author?.follower_count || 0,
                    likeCount: chInfo.author?.total_favorited || 0,
                    videoCount: chInfo.user_count || chInfo.video_count || 0,
                    ipLocation: ''
                };
            }
        }
    }
    
    // If not numeric, or hashtag fetch failed, just mock the profile so the UI shows something,
    // and the video search will use the keyword string as search input.
    return {
        platform: '抖音',
        id: chId, // Use this string for keyword search in fetchVideos
        nickname: `#${decodeURIComponent(chId)}`,
        avatar: 'https://p26-passport.byteacctimg.com/img/user-avatar/1ed50003058fd0e22cc3~300x300.image',
        signature: '话题搜索结果',
        followerCount: 0,
        likeCount: 0,
        videoCount: 0,
        ipLocation: ''
    };
}

export async function fetchDouyinVideoComments(awemeId: string, cursor: number | string = 0, count: number = 30) {
    const apiKey = await getApiKey();
    const finalUrl = `/api/tikhub/api/v1/douyin/web/fetch_video_comments?aweme_id=${awemeId}&cursor=${cursor}&count=${count}`;
    
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    if (!res.ok) {
        throw new Error(`抖音请求失败 (${res.status})`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.status_code !== 0 && data.code !== 0) {
        throw new Error(data.msg || data.message || '获取评论列表失败');
    }
    
    const actualData = data.data || data;
    const comments = actualData.comments || [];
    
    return {
        comments: comments.map((c: any) => ({
            id: c.cid,
            text: c.text,
            likeCount: c.digg_count,
            createTime: c.create_time,
            author: c.user?.nickname || ''
        })),
        hasMore: actualData.has_more === 1 || actualData.has_more === true,
        nextCursor: actualData.cursor || 0
    };
}

export async function fetchDouyinVideos(secUserId: string, maxCursor: number | string = 0, sortType: number = 0): Promise<FetchVideosResult> {
    const apiKey = await getApiKey();
    const finalUrl = `/api/tikhub/api/v1/douyin/web/fetch_user_post_videos?sec_user_id=${secUserId}&max_cursor=${maxCursor}&count=20&sort_type=${sortType}`;
    
    const res = await fetch(finalUrl, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }});
    if (!res.ok) {
        throw new Error(`抖音请求失败 (${res.status})`);
    }
    
    const data = await res.json();
    if (data.code !== 200 && data.status_code !== 0 && data.code !== 0) {
       throw new Error(data.msg || data.message || '获取视频列表失败');
    }

    return parseDouyinVideos(data);
}
