import https from 'https';

async function main() {
    const url = 'https://api.tikhub.io/api/v1/weibo/app/fetch_search_all?query=%e6%99%ae%e4%ba%ac%e6%ac%a2%e8%bf%8e%e4%bb%aa%e5%bc%8f&search_type=64&page=1'
    const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + 'your_api_key_here' }
    });
    console.log(res.status);
    console.log(await res.text());
}
main();
