import http from 'http';
import fs from 'fs';

http.get('http://127.0.0.1:3000/api/tikhub/api/v1/weibo/app/fetch_hot_search', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    fs.writeFileSync('weibo-raw.json', data);
    console.log("Done. File created.");
  });
});
