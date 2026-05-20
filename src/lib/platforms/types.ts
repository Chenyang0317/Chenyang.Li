export type PlatformType = '抖音' | '小红书' | '微博' | 'B站';

export interface UnifiedUserProfile {
  platform: PlatformType;
  id: string; // The platform specific ID (sec_uid, uid, etc)
  nickname: string;
  avatar: string;
  signature: string;
  followerCount: number;
  likeCount: number;
  videoCount: number;
  ipLocation?: string;
  matrixName?: string; // 归属的矩阵名称
  isHotTopic?: boolean; // 标识是否为热门话题
}

export interface UnifiedVideo {
  id: string; // aweme_id, bvid, etc
  title: string; // desc, title
  coverUrl: string;
  videoUrl?: string;
  createTime: number; // Unix timestamp in seconds
  duration: number; // in milliseconds
  author: {
    id: string;
    nickname: string;
    avatar: string;
  };
  stats: {
    playCount?: number;
    likeCount: number; // digg_count, like
    commentCount: number; // comment_count, reply
    collectCount: number; // collect_count, favorite
    shareCount: number; // share_count, share
  };
  platform: PlatformType;
}

export interface FetchVideosResult {
  videos: UnifiedVideo[];
  hasMore: boolean;
  nextCursor: string | number;
}

export interface UnifiedComment {
  id: string;
  text: string;
  likeCount: number;
  createTime: number;
  author: string;
}

export interface FetchCommentsResult {
  comments: UnifiedComment[];
  hasMore: boolean;
  nextCursor: string | number;
}

/**
 * 每个平台必须实现的处理器接口
 * 确保数据解析逻辑完全隔离
 */
export interface PlatformHandler {
  fetchUserProfile(id: string): Promise<UnifiedUserProfile>;
  fetchUserVideos(id: string, cursor: string | number, sortType?: number): Promise<FetchVideosResult>;
  fetchVideoComments?(id: string, cursor: string | number, count?: number): Promise<FetchCommentsResult>;
}
