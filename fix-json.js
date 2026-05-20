import fs from 'fs';
const platforms = ['weibo.ts', 'douyin.ts', 'bilibili.ts', 'xiaohongshu.ts'];
platforms.forEach(p => {
    let content = fs.readFileSync(`src/lib/platforms/${p}`, 'utf8');
    content = content.replace(/const data = await res\.json\(\);/g, `const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { throw new Error('平台接口返回非预期格式（可能触发了防爬拦截，或代理配置失效）：\\n' + text.slice(0, 100) + '...'); }`);
    fs.writeFileSync(`src/lib/platforms/${p}`, content);
});
