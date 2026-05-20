import https from 'https';

const options = {
  hostname: 'weibo.com',
  path: '/ajax/side/hotSearch',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://s.weibo.com/top/summary'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log(Object.keys(json.data));
    console.log("realtime length:", json.data.realtime.length);
    console.log("first realtime item keys:", Object.keys(json.data.realtime[0]));
    console.log("first realtime item:", json.data.realtime[0].word);
  });
}).on('error', console.error);
