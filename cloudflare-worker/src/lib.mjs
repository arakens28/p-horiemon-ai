// 検索条件からキャッシュ用のキーを作る(同じ条件なら同じキー)
export async function cacheKey(p) {
  const raw = [p.pref, p.city, p.industry, p.employeeBand, p.purpose, p.approach, p.budget].join("|");
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export function normalizeParams(body) {
  return {
    pref: String(body.pref || "").slice(0, 10),
    city: String(body.city || "").slice(0, 20),
    industry: String(body.industry || "").slice(0, 30),
    employeeBand: String(body.employeeBand || "").slice(0, 20),
    purpose: String(body.purpose || "").slice(0, 40),
    approach: String(body.approach || "").slice(0, 40),
    budget: String(body.budget || "").slice(0, 20),
  };
}

export function buildPrompt({ pref, city, industry, employeeBand, purpose, approach, budget }) {
  const area = city ? `${pref}${city}` : pref;
  return `あなたは日本の中小企業向け補助金・助成金の調査アシスタントです。

以下の企業が使える可能性のある、「${area}」の自治体独自(市区町村・都道府県レベル)の補助金・助成金をWeb検索で調べてください。
- 所在地: ${area}
- 業種: ${industry || "不明"}
- 従業員数: ${employeeBand || "不明"}
- やりたいこと: ${purpose || "AI活用全般"}
- 進め方: ${approach || "未定"}
- かけられる予算: ${budget || "未定"}

「やりたいこと」「進め方」に合う種類の制度を優先して探すこと:
- 研修・リスキリング・内製化 → 研修費・人材育成への助成金
- 業務効率化・DX・外注 → ITツール・システム導入への補助金
- AIサービス・ツール開発 → 開発費・システム構築費・新事業への補助金
予算規模に合わない制度(予算50万円未満なのに数千万円規模の設備投資補助金など)は優先度を下げること。

条件:
1. 国の制度(人材開発支援助成金、デジタル化・AI導入補助金、ものづくり補助金、持続化補助金、省力化投資補助金)は除外する。自治体独自の制度のみ。
2. 現在(検索時点)で申請可能、または近く募集が見込まれる制度を優先する。募集終了が明確な制度は含めない。
3. 出典は自治体公式サイト(lg.jp等)や公的機関のページを優先する。
4. 最大5件まで。見つからなければ空配列でよい。存在が確認できない制度を推測で作らないこと。
5. 金額・締切が不確かな場合は「要確認」と書く。

最終回答は以下のJSON配列のみを出力してください(説明文・マークダウン・コードブロック記号は一切不要):
[
  {
    "name": "制度名",
    "authority": "実施主体(例: ○○市)",
    "summary": "50字以内の概要",
    "subsidy": "補助率・上限額(不明なら「要確認」)",
    "deadline": "締切または「通年」「要確認」",
    "official_url": "出典URL",
    "ai_related": true
  }
]
ai_relatedは、AI研修・DX・IT導入・システム開発に使える可能性がある場合にtrue。`;
}

export function extractJson(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function sanitize(programs) {
  return programs
    .filter((p) => p && typeof p.name === "string" && p.name.trim())
    .slice(0, 5)
    .map((p) => ({
      name: String(p.name).slice(0, 100),
      authority: String(p.authority || "要確認").slice(0, 50),
      summary: String(p.summary || "").slice(0, 120),
      subsidy: String(p.subsidy || "要確認").slice(0, 120),
      deadline: String(p.deadline || "要確認").slice(0, 80),
      official_url: /^https?:\/\//.test(p.official_url || "") ? p.official_url : null,
      ai_related: Boolean(p.ai_related),
    }));
}

const ALLOWED_ORIGIN = "https://p.horiemon.ai";
export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...corsHeaders(), ...(init.headers || {}) },
  });
}
