const http = require('http');

http.get('http://127.0.0.1:3000/api/tikhub/api/v1/weibo/app/fetch_hot_search?type=realtimehot', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    // just write to file
    require('fs').writeFileSync('weibo-raw.json', data);
    console.log("Done");
  });
});
