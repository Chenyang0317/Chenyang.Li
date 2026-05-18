import fs from 'fs';
fetch('https://api.tikhub.io/openapi.json')
  .then(res => res.json())
  .then(data => {
    Object.keys(data.paths).forEach(p => {
        if (p.includes('bilibili') && p.includes('user_profile')) {
            console.log("PROFILE APP:");
            console.log(p);
        }
        if (p.includes('bilibili') && p.includes('video') && !p.includes('comments')) {
            console.log("VIDEO APP:");
            console.log(p);
        }
    });
  });
