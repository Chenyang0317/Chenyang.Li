import https from 'https';

https.get('https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot', (res) => {
  console.log("Status:", res.statusCode);
  console.log("Headers:", res.headers);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data.slice(0, 500));
  });
}).on('error', console.error);
