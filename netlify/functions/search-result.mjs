import { getStore } from "@netlify/blobs";
import { cacheKey, normalizeParams } from "./lib/common.mjs";

// 検索結果の取り出し用。フロントが数秒おきに呼び、結果ができていれば返す。

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const params = normalizeParams(body);
  if (!params.pref) {
    return Response.json({ error: "pref is required" }, { status: 400 });
  }

  const store = getStore("search-results");
  // バックグラウンド処理直後の結果を確実に取得できるよう強整合性で読む。
  const data = await store.get(cacheKey(params), { type: "json", consistency: "strong" });

  if (!data) return Response.json({ status: "pending" });
  if (data.error) return Response.json({ status: "error", programs: [] });
  return Response.json({ status: "done", programs: data.programs, searched_area: data.searched_area, searched_at: data.searched_at });
};

export const config = { path: "/api/search-result" };
