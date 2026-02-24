/**
 * Vercel Serverless Function：代理 YouBike API
 * 
 * 部署到 Vercel 後，前端呼叫 /api/youbike 會由這個 function 轉發
 * 完全解決 CORS 問題，且可在伺服器端快取資料。
 * 
 * 路徑：/api/youbike.js → 對應 URL：https://你的網域/api/youbike
 */

const YOUBIKE_API = "https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json";

// 簡易記憶體快取（同一個 serverless 實例內有效，減少對 YouBike 的請求次數）
let cache = { data: null, ts: 0 };
const CACHE_TTL = 30 * 1000; // 30 秒

export default async function handler(req, res) {
  // 允許所有來源（前端同域呼叫不需要，但保留以防 preview branch 不同域）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // 回傳快取（若還新鮮）
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  try {
    const upstream = await fetch(YOUBIKE_API, {
      headers: {
        'User-Agent': 'YouBikeTracker/1.0',
      },
    });

    if (!upstream.ok) {
      throw new Error(`Upstream error: ${upstream.status}`);
    }

    const data = await upstream.json();

    // 更新快取
    cache = { data, ts: Date.now() };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (err) {
    console.error("YouBike proxy error:", err);
    return res.status(502).json({ error: "無法連線至 YouBike API", message: err.message });
  }
}
