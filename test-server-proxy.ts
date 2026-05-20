import http from 'http';
http.get("http://localhost:3000/api/tikhub/api/v1/weibo/app/fetch_search_all?query=%E6%99%AE%E4%BA%AC%E6%AC%A2%E8%BF%8E%E4%BB%AA%E5%BC%8F&search_type=64&page=1", (res) => {
  let data = '';
  res.on('data', c => data+=c);
  res.on('end', () => console.log(res.statusCode, data.slice(0, 200)));
});
