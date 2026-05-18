import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add proxy for TikHub API
  app.use('/api/tikhub', createProxyMiddleware({ 
    target: 'https://api.tikhub.io', 
    changeOrigin: true,
    pathRewrite: {
      '^/api/tikhub': '', // remove base path
    },
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
