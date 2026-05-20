import https from 'https';

console.log("Fetching weibo search");
const keyword = encodeURIComponent("普京欢迎仪式");
const options = {
  hostname: 'weibo.com',
  path: `/ajax/statuses/searchProfile?q=${keyword}`,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
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
