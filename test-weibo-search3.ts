import https from 'https';

console.log("Fetching weibo search");
const keyword = encodeURIComponent("普京欢迎仪式");
const options = {
  hostname: 'm.weibo.cn',
  path: `/api/container/getIndex?containerid=100103type%3D1%26q%3D${keyword}&page_type=searchall`,
  headers: {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json, text/plain, */*',
    'MWeibo-Pwa': '1',
    'X-Requested-With': 'XMLHttpRequest'
  }
};
https.get(options, (res) => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => {
    console.log(res.statusCode);
    console.log(data.slice(0,500));
  });
});
