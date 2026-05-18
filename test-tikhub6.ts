import fs from 'fs';
fetch('https://api.tikhub.io/openapi.json')
  .then(res => res.json())
  .then(data => {
    // let's just log the response schema for fetch_user_videos
    const okRes = data.paths['/api/v1/bilibili/app/fetch_user_videos'].get.responses['200'];
    console.log(JSON.stringify(okRes, null, 2));
  });
