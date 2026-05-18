import "dotenv/config";
import fetch from "node-fetch";

async function run() {
  const apiKey = process.env.VITE_TIKHUB_API_KEY || "your_api_key_here";
  const url = "https://api.tikhub.io/api/v1/tikhub/user/get_user_daily_usage";
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run();
