async function main() {
  const r = await fetch('https://api.tikhub.io/api/v1/weibo/app/fetch_search_all?query=%e6%99%ae%e4%ba%ac&search_type=64&page=1');
  const t = await r.text();
  console.log(r.status, r.headers.get('content-type'));
  console.log(t.substring(0, 200));
}
main();
