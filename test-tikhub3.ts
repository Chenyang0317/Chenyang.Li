import fs from 'fs';
fetch('https://api.tikhub.io/openapi.json')
  .then(res => res.json())
  .then(data => {
    Object.keys(data.paths).forEach(p => {
        if (p.includes('bilibili')) {
            console.log(p);
        }
    });
  });
