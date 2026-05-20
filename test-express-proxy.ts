import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';

const app = express();
app.use('/api', createProxyMiddleware({
  target: 'https://api.tikhub.io',
  changeOrigin: true,
  onProxyRes: (proxyRes, req, res) => {
    if (req.url.includes('weibo')) {
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => console.log('Proxy body length:', body.length));
    }
  }
}));
app.listen(3001, () => {
  http.get("http://localhost:3001/api/api/v1/weibo/app/fetch_search_all?query=test", res => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => console.log('Client received length:', d.length));
  });
});
