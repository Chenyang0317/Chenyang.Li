import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get('/api/weibo-hot', async (req, res) => {
    try {
      const response = await fetch('https://weibo.com/ajax/side/hotSearch', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://s.weibo.com/top/summary'
        }
      });
      if (!response.ok) {
        throw new Error(`Weibo API Error: ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/_dump_weibo', express.json({ limit: '10mb' }), (req, res) => {
    require('fs').writeFileSync('weibo-raw.json', JSON.stringify(req.body, null, 2));
    res.json({ok: 1});
  });

  // Add proxy for TikHub API
  app.use('/api/tikhub', createProxyMiddleware({ 
    target: 'https://api.tikhub.io', 
    changeOrigin: true,
    pathRewrite: {
      '^/api/tikhub': '', // remove base path
    }
  }));

  // Add Weibo public proxy
  app.use('/api/weibo-public', createProxyMiddleware({
    target: 'https://m.weibo.cn',
    changeOrigin: true,
    pathRewrite: {
      '^/api/weibo-public': '',
    },
    headers: {
      'Referer': 'https://m.weibo.cn/'
    }
  }));

  // Add proxy for Atypica API
  app.use('/api/atypica', createProxyMiddleware({
    target: 'https://api.atypica.ai',
    changeOrigin: true,
    pathRewrite: {
      '^/api/atypica': '', // remove base path
    },
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
