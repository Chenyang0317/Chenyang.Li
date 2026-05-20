import fs from 'fs';

const raw = fs.readFileSync('weibo-raw.json', 'utf8');
console.log(raw.slice(0, 500));
