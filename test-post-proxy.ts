import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';

const app = express();
app.use(express.json()); // global parser
app.use('/api/tikhub', createProxyMiddleware({
  target: 'https://api.tikhub.io',
  changeOrigin: true,
  pathRewrite: { '^/api/tikhub': '' }
}));
app.listen(3003, () => {
  const req = http.request({
    method: 'POST',
    host: 'localhost',
    port: 3003,
    path: '/api/tikhub/api/v1/douyin/search/fetch_video_search_v2',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Data:', d.slice(0, 50));
      process.exit(0);
    });
  });
  req.write(JSON.stringify({ keyword: 'test' }));
  req.end();
});
