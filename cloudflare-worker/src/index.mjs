import { cacheKey, normalizeParams, buildPrompt, extractJson, sanitize, corsHeaders, json } from "./lib.mjs";

const MODEL = "claude-sonnet-4-6";
const MAX_CONTINUATIONS = 3;
const CACHE_DAYS = 7; // 同じ条件の検索結果を使い回す日数
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60; // 秒。予期しない連続利用による費用増加を抑止する。

async function checkRateLimit(env, ip) {
  const key = `ratelimit:${ip}`;
  const count = parseInt((await env.SEARCH_RESULTS.get(key)) || "0", 10);
  if (count >= RATE_LIMIT_MAX) return false;
  await env.SEARCH_RESULTS.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW });
  return true;
}

async function runSearch(env, params, key) {
  const userQuery = buildPrompt(params);
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];

  const call = (msgs) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, output_config: { effort: "low" }, tools, messages: msgs }),
    }).then((r) => r.json());

  try {
    let messages = [{ role: "user", content: userQuery }];
    let response = await call(messages);

    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
      messages = [
        { role: "user", content: userQuery },
        { role: "assistant", content: response.content },
      ];
      response = await call(messages);
      continuations++;
    }

    const text = (response.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = extractJson(text);

    await env.SEARCH_RESULTS.put(
      key,
      JSON.stringify({
        programs: sanitize(parsed || []),
        searched_area: params.city ? `${params.pref}${params.city}` : params.pref,
        searched_at: new Date().toISOString(),
      }),
      { expirationTtl: CACHE_DAYS * 86400 }
    );
  } catch (err) {
    await env.SEARCH_RESULTS.put(
      key,
      JSON.stringify({ programs: [], error: true, searched_at: new Date().toISOString() }),
      { expirationTtl: 86400 }
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const url = new URL(request.url);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, { status: 400 });
    }
    const params = normalizeParams(body);
    if (!params.pref) {
      return json({ error: "pref is required" }, { status: 400 });
    }
    const key = await cacheKey(params);

    if (url.pathname === "/api/search-local") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await checkRateLimit(env, ip))) {
        return json({ error: "rate limited" }, { status: 429 });
      }

      const existingRaw = await env.SEARCH_RESULTS.get(key);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        if (!existing.error && existing.searched_at) {
          const ageDays = (Date.now() - new Date(existing.searched_at).getTime()) / 86400000;
          if (ageDays < CACHE_DAYS) return json({}, { status: 202 });
        }
      }

      ctx.waitUntil(runSearch(env, params, key));
      return json({}, { status: 202 });
    }

    if (url.pathname === "/api/search-result") {
      const raw = await env.SEARCH_RESULTS.get(key);
      if (!raw) return json({ status: "pending" });
      const data = JSON.parse(raw);
      if (data.error) return json({ status: "error", programs: [] });
      return json({
        status: "done",
        programs: data.programs,
        searched_area: data.searched_area,
        searched_at: data.searched_at,
      });
    }

    return json({ error: "Not found" }, { status: 404 });
  },
};
