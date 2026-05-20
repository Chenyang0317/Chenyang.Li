import https from 'https';

console.log("Fetching weibo search");
const keyword = encodeURIComponent("普京欢迎仪式");
const options = {
  hostname: 'm.weibo.cn',
  path: `/api/container/getIndex?containerid=100103type%3D1%26q%3D${keyword}`,
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};
https.get(options, (res) => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => {
    console.log(res.statusCode);
    const json = JSON.parse(data);
    console.log(Object.keys(json.data.cards[0]));
  });
});
