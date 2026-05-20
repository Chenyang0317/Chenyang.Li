import { fetchWeiboHashtagVideos, fetchWeiboHashtagProfile } from './src/lib/platforms/weibo.js';

async function main() {
  try {
    const profile = await fetchWeiboHashtagProfile('#普京欢迎仪式#');
    console.log('Profile:', profile);
    const videos = await fetchWeiboHashtagVideos('#普京欢迎仪式#', '1');
    console.log('Videos:', videos);
  } catch (e) {
    console.error('Error fetching weibo hashtag videos:', e);
  }
}
main();
