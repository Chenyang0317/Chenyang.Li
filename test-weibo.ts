import { fetchHotSearchList } from './src/lib/tikhub';

async function test() {
    process.env.NODE_ENV = 'development'; // no
    const MOCK_STORAGE: Record<string, string> = {
        'tikhub_api_key': 'YOUR_KEY_HERE' // I don't have the real key, but I'll see if I can run it
    };
}
