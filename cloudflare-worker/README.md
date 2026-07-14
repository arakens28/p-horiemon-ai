# 助成金診断ツール AI検索用 Cloudflare Worker

`joseikin-shindan/index.html` の「自治体独自制度のAI検索」機能のバックエンド。

本番ドメイン `p.horiemon.ai` はGitHub Pages配信のため、サーバー処理(Anthropic APIキーを
使ったWeb検索)が実行できない。そのため、この機能だけ独立したCloudflare Workerとして動かし、
フロントエンドからクロスオリジンで呼び出している。

## 構成

- `POST /api/search-local` … 検索を開始(即202を返し、`ctx.waitUntil`でバックグラウンド実行)
- `POST /api/search-result` … 検索結果を取得(KVに保存された結果をポーリングで取り出す)
- CORSは `https://p.horiemon.ai` からのみ許可

## デプロイ

```
cd cloudflare-worker
npx wrangler deploy
```

## 必要なSecret

```
npx wrangler secret put ANTHROPIC_API_KEY
```

## 運用アカウント

現在 `imai@telewor.com` のCloudflareアカウントで運用。管理者を変更する場合はWorker・KV
ネームスペースの移管、またはSecretの再設定が必要。
