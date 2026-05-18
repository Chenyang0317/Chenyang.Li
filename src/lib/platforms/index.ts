import { FetchVideosResult, PlatformType, UnifiedUserProfile, UnifiedVideo, FetchCommentsResult } from './types';
import { fetchDouyinUserProfile, fetchDouyinVideos, fetchDouyinHashtagProfile, fetchDouyinHashtagVideos, fetchDouyinVideoComments } from './douyin';
import { fetchBilibiliUserProfile, fetchBilibiliVideos, fetchBilibiliHashtagProfile, fetchBilibiliHashtagVideos, fetchBilibiliVideoComments } from './bilibili';
import { fetchXiaohongshuUserProfile, fetchXiaohongshuVideos, fetchXiaohongshuVideoComments, fetchXiaohongshuHashtagProfile, fetchXiaohongshuHashtagVideos } from './xiaohongshu';
import { fetchWeiboUserProfile, fetchWeiboVideos, fetchWeiboHashtagProfile, fetchWeiboHashtagVideos, fetchWeiboVideoComments } from './weibo';

export * from './types';

export async function fetchUserProfile(platform: PlatformType, query: string, mode: 'user' | 'topic' = 'user'): Promise<UnifiedUserProfile> {
    switch (platform) {
        case '抖音':
            if (mode === 'topic') return fetchDouyinHashtagProfile(query);
            return fetchDouyinUserProfile(query);
        case 'B站':
            if (mode === 'topic') return fetchBilibiliHashtagProfile(query);
            return fetchBilibiliUserProfile(query);
        case '小红书':
            if (mode === 'topic') return fetchXiaohongshuHashtagProfile(query);
            return fetchXiaohongshuUserProfile(query);
        case '微博':
            if (mode === 'topic') return fetchWeiboHashtagProfile(query);
            return fetchWeiboUserProfile(query);
        default:
            throw new Error(`暂不支持平台: ${platform}`);
    }
}

export async function fetchUserVideos(platform: PlatformType, id: string, cursor: number | string = 0, sortType: number = 0, mode: 'user' | 'topic' = 'user', publishTime: number = 0): Promise<FetchVideosResult> {
    switch (platform) {
        case '抖音':
            if (mode === 'topic') return fetchDouyinHashtagVideos(id, cursor, sortType, publishTime);
            return fetchDouyinVideos(id, cursor, sortType);
        case 'B站':
            const page = cursor === 0 || cursor === '0' ? 1 : Number(cursor) || 1;
            if (mode === 'topic') return fetchBilibiliHashtagVideos(id, page, sortType);
            return fetchBilibiliVideos(id, page, sortType);
        case '小红书':
            if (mode === 'topic') return fetchXiaohongshuHashtagVideos(id, String(cursor === 0 || cursor === '0' ? '' : cursor), sortType);
            return fetchXiaohongshuVideos(id, String(cursor === 0 || cursor === '0' ? '' : cursor), sortType);
        case '微博':
            if (mode === 'topic') return fetchWeiboHashtagVideos(id, cursor, sortType);
            return fetchWeiboVideos(id, String(cursor), sortType);
        default:
            throw new Error(`暂不支持平台: ${platform}`);
    }
}

export async function fetchVideoComments(platform: PlatformType, id: string, cursor: number | string = 0, count: number = 20): Promise<FetchCommentsResult> {
    switch (platform) {
        case '抖音':
            return fetchDouyinVideoComments(id, cursor, count);
        case 'B站':
            const bCursor = cursor === 0 || cursor === '0' ? '' : String(cursor);
            return fetchBilibiliVideoComments(id, bCursor, count);
        case '小红书':
            const xCursor = cursor === 0 || cursor === '0' ? '' : String(cursor);
            return fetchXiaohongshuVideoComments(id, xCursor, count);
        case '微博':
            const wCursor = cursor === 0 || cursor === '0' ? '' : String(cursor);
            return fetchWeiboVideoComments(id, wCursor, count);
        default:
            throw new Error(`暂不支持平台 ${platform} 的评论分析`);
    }
}
