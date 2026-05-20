import http from 'http';
http.get("http://localhost:3000/api/tikhub/api/v1/weibo/app/fetch_search_all?query=test&search_type=64&page=1", res => {
  let d = '';
  res.on('data', c => d+=c);
  res.on('end', () => console.log(res.statusCode, d.slice(0, 200)));
});
