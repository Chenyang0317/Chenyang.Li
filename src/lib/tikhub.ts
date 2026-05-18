import { storage } from './storage';

const API_BASE = 'https://api.tikhub.io';

async function getApiKey(): Promise<string> {
    const key = await storage.get<string>('tikhub_api_key');
    if (!key) throw new Error('API Key 未配置，请先在右上角【设置/API】中配置 TikHub API Key。');
    return key;
}

export interface TikHubVideo {
    aweme_id: string;
    desc: string;
    create_time: number;
    video: {
        cover: {
            url_list: string[];
        };
        play_addr: {
            url_list: string[];
        };
        duration: number; // in ms
    };
    statistics: {
        digg_count: number;
        comment_count: number;
        collect_count: number;
        share_count: number;
    };
    author: {
        nickname: string;
        sec_uid: string;
        avatar_thumb: {
            url_list: string[];
        };
    };
}

export interface TikHubUserProfile {
    user: {
        nickname: string;
        signature: string;
        avatar_larger: {
            url_list: string[];
        };
        follower_count: number;
        total_favorited: number;
        aweme_count: number;
        ip_location: string;
        sec_uid: string;
    }
}

export async function fetchUserVideos(secUserId: string, maxCursor: number = 0, sortType: number = 0): Promise<{ videos: TikHubVideo[], hasMore: boolean, nextCursor: number }> {
    const apiKey = await getApiKey();
    // sort_type: 0: 最新排序, 1: 最热排序
    const url = `${API_BASE}/api/v1/douyin/web/fetch_user_post_videos?sec_user_id=${secUserId}&max_cursor=${maxCursor}&count=20&sort_type=${sortType}`;
    
    // In actual production without CORS proxy, TikHub might need proxy or CORS handling, assuming it supports CORS.
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
        }
    });
    
    if (!res.ok) {
        throw new Error(`请求失败: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Need to handle TikHub specific wrapper if exists. Assuming structure based on standard api.
    if (data.code !== 200 && data.status_code !== 0 && data.code !== 0) {
       console.error("API Error Response:", data);
       // Sometimes TikHub returns error in data.msg
       throw new Error(data.msg || data.message || '获取视频列表失败');
    }

    // TikHub v1/douyin/web generally wraps the actual response in data.data or returns directly.
    const actualData = data.data || data;

    return {
        videos: actualData.aweme_list || [],
        hasMore: actualData.has_more === 1 || actualData.has_more === true,
        nextCursor: actualData.max_cursor || 0
    };
}

export async function fetchUserProfile(secUserId: string): Promise<TikHubUserProfile> {
    const apiKey = await getApiKey();
    
    // Using the endpoint provided in the prompt
    const url = `${API_BASE}/api/v1/douyin/app/v3/handler_user_profile?sec_user_id=${secUserId}`;
    
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
        }
    });
    
    if (!res.ok) {
        throw new Error(`请求失败: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (data.code !== 200 && data.status_code !== 0 && data.code !== 0) {
        console.error("API Error Response:", data);
        throw new Error(data.msg || data.message || '获取博主信息失败');
    }

    const actualData = data.data || data;

    return actualData;
}
