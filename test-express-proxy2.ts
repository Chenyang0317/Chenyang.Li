import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';

const app = express();
app.use(express.json()); // simulate global parser
app.use('/api/tikhub', createProxyMiddleware({
  target: 'https://api.tikhub.io',
  changeOrigin: true,
  pathRewrite: { '^/api/tikhub': '' }
}));
app.listen(3002, () => {
  http.get("http://localhost:3002/api/tikhub/api/v1/weibo/app/fetch_search_all?query=test&search_type=64&page=1", res => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => {
      console.log(res.statusCode, d.slice(0, 50));
      process.exit(0);
    });
  });
});
