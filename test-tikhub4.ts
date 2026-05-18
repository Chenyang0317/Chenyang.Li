import fs from 'fs';
fetch('https://api.tikhub.io/openapi.json')
  .then(res => res.json())
  .then(data => {
    console.log("APP USER INFO:");
    console.log(JSON.stringify(data.paths['/api/v1/bilibili/app/fetch_user_info'].get.parameters, null, 2));

    console.log("APP USER VIDEOS:");
    console.log(JSON.stringify(data.paths['/api/v1/bilibili/app/fetch_user_videos'].get.parameters, null, 2));
  });
