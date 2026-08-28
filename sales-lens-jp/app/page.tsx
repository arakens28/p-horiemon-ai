"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Meeting = {
  id: string | number;
  recordId?: string;
  meetingDate?: string;
  reportMarkdown?: string;
  syncedAt?: string;
  company: string;
  contact: string;
  title: string;
  type: "法人研修" | "フランチャイズ";
  confidence: "A" | "B" | "C";
  status: string;
  time: string;
  duration: string;
  summary: string;
  concern: string;
  next: string;
  owner: string;
  due: string;
  signal: number;
  good: string[];
  improve: string[];
  moments: { time: string; label: string; tone: "good" | "warn" | "plain" }[];
};

const demoMeetings: Meeting[] = [
  {
    id: 1,
    company: "東都設備株式会社",
    contact: "佐野様",
    title: "法人AI研修 個別相談",
    type: "法人研修",
    confidence: "A",
    status: "見積調整中",
    time: "本日 10:30",
    duration: "24分",
    summary: "管理部門12名での導入を前向きに検討。助成金の対象人数と開始時期まで合意し、残る論点は役員向けの費用説明のみ。",
    concern: "役員会で投資対効果を一枚で説明したい",
    next: "費用対効果の比較表を添えて見積を送付",
    owner: "飯泉",
    due: "明日 12:00",
    signal: 88,
    good: ["利用ツールを先に聞き、提案理由につなげた", "助成金への懸念に数字で即答できた"],
    improve: ["決裁者本人の評価軸をもう一段聞く", "クロージング後の追加説明を短くする"],
    moments: [
      { time: "02:14", label: "業務ツールと対象人数を確認", tone: "good" },
      { time: "08:42", label: "現状に沿って研修内容を提案", tone: "good" },
      { time: "16:08", label: "役員会の判断基準が未確認", tone: "warn" },
      { time: "21:31", label: "見積送付で次の約束を確定", tone: "plain" },
    ],
  },
  {
    id: 2,
    company: "BluePeak Studio",
    contact: "高瀬様",
    title: "AIスクールFC相談",
    type: "フランチャイズ",
    confidence: "B",
    status: "再商談待ち",
    time: "昨日 16:00",
    duration: "18分",
    summary: "既存の制作顧客へAI研修を展開したい意向。事業モデルへの関心は高いが、初期投資と売上折半の理解に時間を要した。",
    concern: "初期投資の回収に必要な顧客社数が見えない",
    next: "3つの販売シナリオを提示して再商談を設定",
    owner: "飯泉",
    due: "8月4日",
    signal: 72,
    good: ["受注ゼロ時のリスクに正面から回答した", "顧客側の経済性を具体例で示した"],
    improve: ["費用と時間軸を最初に一枚で見せる", "助成金の対象人数を説明前に確認する"],
    moments: [
      { time: "00:44", label: "本業との接続を確認", tone: "good" },
      { time: "07:12", label: "金額説明が連続し理解が停滞", tone: "warn" },
      { time: "12:36", label: "受注ゼロ時の条件に即答", tone: "good" },
      { time: "16:50", label: "資料送付で終了、再商談は未確定", tone: "warn" },
    ],
  },
  {
    id: 3,
    company: "北浜ケアサービス",
    contact: "森本様",
    title: "法人AI研修 個別相談",
    type: "法人研修",
    confidence: "B",
    status: "社内検討中",
    time: "昨日 13:15",
    duration: "31分",
    summary: "現場の記録作成を効率化したいニーズが明確。個人情報の扱いが最大の懸念で、セキュリティ資料の確認後に判断予定。",
    concern: "利用者情報を外部AIへ入力できない",
    next: "匿名化運用とセキュリティ方針を送付",
    owner: "飯泉",
    due: "本日中",
    signal: 69,
    good: ["業務フローを具体的に聞けた", "懸念を否定せず運用案へ展開した"],
    improve: ["情報管理責任者を次回同席にする", "技術説明を短くし判断材料に絞る"],
    moments: [
      { time: "03:18", label: "記録業務の工数を確認", tone: "good" },
      { time: "11:05", label: "個人情報への懸念が表面化", tone: "warn" },
      { time: "18:24", label: "匿名化フローを提案", tone: "good" },
      { time: "28:03", label: "次回の同席者は未確定", tone: "warn" },
    ],
  },
  {
    id: 4,
    company: "森川精工",
    contact: "杉浦様",
    title: "セミナー後 個別相談",
    type: "法人研修",
    confidence: "C",
    status: "温度感低め",
    time: "7月29日",
    duration: "14分",
    summary: "情報収集が主目的で、導入時期と対象部署は未定。具体的な困りごとを引き出せず、資料送付のみで終了。",
    concern: "今すぐ取り組む理由がない",
    next: "製造業の活用事例を送り、3カ月後に再確認",
    owner: "飯泉",
    due: "10月末",
    signal: 38,
    good: ["無理にクロージングしなかった", "検討時期が先であることを確認した"],
    improve: ["日常業務の詰まりから質問を始める", "次回連絡の条件を具体化する"],
    moments: [
      { time: "01:46", label: "参加目的を確認", tone: "plain" },
      { time: "05:32", label: "課題が曖昧なまま商品説明へ", tone: "warn" },
      { time: "12:18", label: "検討時期を確認", tone: "good" },
    ],
  },
  {
    id: 5,
    company: "南青山パートナーズ",
    contact: "木戸様",
    title: "AI事業パートナー相談",
    type: "フランチャイズ",
    confidence: "B",
    status: "資料確認中",
    time: "7月28日",
    duration: "27分",
    summary: "紹介型の連携に関心。FC本体より軽量な取次モデルが適合し、契約条件の確認へ進んでいる。",
    concern: "自社で運営人員を持たずに始めたい",
    next: "取次モデルの契約条件を法務担当へ送付",
    owner: "飯泉",
    due: "8月5日",
    signal: 76,
    good: ["相手の体制に合わせて別プランへ切り替えた", "紹介後の役割分担を明確にした"],
    improve: ["希望契約形態を冒頭で聞く", "契約確認の期限を合意する"],
    moments: [
      { time: "02:02", label: "運営体制を確認", tone: "good" },
      { time: "09:18", label: "FC本体の説明が長い", tone: "warn" },
      { time: "17:44", label: "取次モデルへ切り替え", tone: "good" },
      { time: "24:10", label: "契約確認の期限は未設定", tone: "warn" },
    ],
  },
];

const nav = ["ホーム", "商談一覧", "プレイブック", "設定"];

function createFullReport(meeting: Meeting) {
  const isFc = meeting.type === "フランチャイズ";
  const facts = isFc
    ? [
        ["本業・顧客基盤", meeting.id === 2 ? "制作・デジタル支援。既存顧客へAI研修を展開できる可能性あり" : "既存顧客との接点を持ち、新規事業としてAI支援を検討"],
        ["AI利用状況", "社内業務で生成AIを利用。実務への関心は比較的高い"],
        ["検討している形", meeting.id === 5 ? "運営負荷の軽い取次モデル" : "自社の学習と顧客向け事業展開の両立"],
        ["確認できていない点", "従業員数、助成金対象人数、投資決裁者、希望する独占区分"],
      ]
    : [
        ["検討対象", meeting.id === 1 ? "管理部門12名での導入を想定" : "複数名での法人研修を検討"],
        ["現在の課題", meeting.concern],
        ["導入目的", meeting.id === 3 ? "現場記録の効率化と情報管理の両立" : "定型業務の効率化と社内AI人材の育成"],
        ["確認できていない点", meeting.id === 1 ? "役員会の判断基準と最終決裁者本人の懸念" : "対象人数、開始希望月、決裁プロセス"],
      ];

  const proposals = isFc
    ? ["加盟後3〜6カ月で自社のAI化を進め、成功事例を既存顧客へ横展開する", "講義は本部、法人営業と月1回の伴走支援は加盟店が担当する", "助成金後の実質負担、顧客単価、売上折半を一つの収益モデルとして提示する"]
    : ["現在の業務ツールと課題に沿って、生成AI研修と月1回の伴走支援を組み合わせる", "研修で学ぶだけでなく、対象業務のワークフロー構築まで支援する", "助成金の適用条件を確認し、実質負担と開始時期を明確にする"];

  const objections = isFc
    ? [[meeting.concern, "販売シナリオ別の回収期間を示し、受注ゼロ時の固定費・ペナルティも分けて説明"], ["契約期間中に追加費用が発生しないか", "初期費用、更新料、売上分配を別々に整理して回答"]]
    : [[meeting.concern, meeting.id === 3 ? "匿名化ルールと入力禁止情報を分け、運用案とセキュリティ資料を提示" : "費用対効果と導入後の成果指標を一枚に整理して提示"], ["eラーニングだけで実務改善まで進むのか", "月1回の伴走面談で業務選定から実装まで支援すると回答"]];

  return {
    facts,
    needs: [meeting.concern, isFc ? "自社の既存事業とAI研修をどう接続するか" : "研修を実務の業務改善までつなげたい", "社内で判断するための具体的な費用・条件をそろえたい"],
    proposals,
    objections,
    decisions: [meeting.next, "追加資料を確認したうえで次の判断へ進む", meeting.confidence === "A" ? "条件確認後、見積調整へ進む" : "現時点では最終契約判断には至っていない"],
    flags: isFc
      ? ["助成率と実質負担額の計算内訳は、最新資料との照合が必要", "契約期間・更新料・活動開始時期は混同しやすいため原本確認", "会社名・従業員数・決裁者は次回商談で確認"]
      : ["助成金の対象人数・助成率・開始可能日は原本確認", meeting.id === 3 ? "個人情報・セキュリティ条件は情報管理責任者の確認が必要" : "固有名詞と利用ツール名はNottaの誤変換に注意", "期限が『早めに』等の表現の場合は具体日へ置き換える"],
    comparison: isFc
      ? [["説明順", "支援内容から順に説明", "時間軸→お金の流れ→支援内容", "契約期間と費用の混線を防げる"], ["投資回収", "平均単価のみ提示", "弱気・標準・強気の3シナリオ", "自社に置き換えて判断できる"], ["本業との接続", "汎用的なFC説明", "既存顧客からの案件化を試算", "FC単体以外の価値も見える"]]
      : [["提案の根拠", "おすすめツールを先に提示", "現状ツール→不足機能→比較→結論", "一方的な推薦に見えない"], ["成果の示し方", "研修内容を中心に説明", "対象業務・削減時間・定着指標で提示", "役員会で説明しやすい"], ["クロージング", "資料送付で終了", "担当・期限・次回判断事項を合意", "商談が止まりにくい"]],
  };
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<Meeting["id"]>(1);
  const [syncedMeetings, setSyncedMeetings] = useState<Meeting[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>();
  const [filter, setFilter] = useState<"すべて" | "法人研修" | "フランチャイズ">("すべて");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"概要" | "コーチング">("概要");
  const [activeNav, setActiveNav] = useState("ホーム");
  const [reportOpen, setReportOpen] = useState(false);
  const meetings = syncedMeetings.length > 0 ? syncedMeetings : demoMeetings;

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/meetings", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { meetings?: Meeting[]; source?: string };
        if (!active || !data.meetings?.length || data.source !== "live") return;
        setSyncedMeetings(data.meetings);
        setLastSyncedAt(data.meetings[0]?.syncedAt);
        setSelectedId((current) => data.meetings?.some((meeting) => meeting.id === current) ? current : data.meetings![0].id);
      } catch {
        // データベースが未設定でもデモ画面は利用できる。
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const visible = useMemo(() => {
    return meetings.filter((meeting) => {
      const matchesFilter = filter === "すべて" || meeting.type === filter;
      const needle = query.trim().toLowerCase();
      const matchesQuery = !needle || `${meeting.company}${meeting.contact}${meeting.title}`.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, meetings]);

  const selected = meetings.find((meeting) => meeting.id === selectedId) ?? meetings[0];
  const fullReport = createFullReport(selected);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="Sales Lens">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Sales Lens</span>
        </div>

        <nav className="main-nav" aria-label="メインナビゲーション">
          {nav.map((item, index) => (
            <button className={activeNav === item ? "nav-item active" : "nav-item"} key={item} onClick={() => setActiveNav(item)}>
              <span className="nav-glyph">{["H", "M", "P", "S"][index]}</span>
              <span>{item}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sync-status"><span className="status-dot" />{syncedMeetings.length ? "Notta 自動同期" : "デモデータ"}</div>
          <div className="profile">
            <span className="avatar">YI</span>
            <span><strong>飯泉 陽平</strong><small>営業担当</small></span>
            <span className="more">···</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">SALES ANALYTICS</p>
            <h1>今日、動くべき商談</h1>
            <p className="subtitle">商談内容から、優先順位と次の一手を整理しました。</p>
          </div>
          <div className="header-actions">
            <button className="icon-button" aria-label="通知"><span className="bell" /><b>2</b></button>
            <button className="primary-button"><span>＋</span> 分析を実行</button>
          </div>
        </header>

        <section className="metrics" aria-label="営業指標">
          <article className="metric-card accent">
            <p>要対応</p><strong>{meetings.filter((meeting) => /本日|明日|要確認/.test(meeting.due)).length}</strong><span>直近のアクション</span>
            <div className="spark"><i /><i /><i /><i /><i /></div>
          </article>
          <article className="metric-card">
            <p>受注確度 A</p><strong>{meetings.filter((meeting) => meeting.confidence === "A").length}</strong><span className="positive">優先フォロー</span>
            <div className="mini-ring"><b>40%</b></div>
          </article>
          <article className="metric-card">
            <p>分析済み商談</p><strong>{meetings.length}</strong><span>法人 {meetings.filter((meeting) => meeting.type === "法人研修").length} / FC {meetings.filter((meeting) => meeting.type === "フランチャイズ").length}</span>
            <div className="stacked"><i /><i /></div>
          </article>
          <article className="metric-card">
            <p>要確認フラグ</p><strong>4</strong><span>金額・固有名詞</span>
            <div className="flag-mark">!</div>
          </article>
        </section>

        <section className="content-grid">
          <div className="meeting-panel">
            <div className="panel-head">
              <div><h2>商談キュー</h2><span>{visible.length}件</span></div>
              <button className="text-button">すべて表示</button>
            </div>
            <div className="controls">
              <label className="search"><span /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="会社名・担当者で検索" aria-label="商談を検索" /></label>
              <div className="segmented" aria-label="商談種別フィルター">
                {(["すべて", "法人研修", "フランチャイズ"] as const).map((item) => (
                  <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item === "フランチャイズ" ? "FC" : item}</button>
                ))}
              </div>
            </div>
            <div className="meeting-list">
              {visible.map((meeting) => (
                <button key={meeting.id} className={selected.id === meeting.id ? "meeting-row selected" : "meeting-row"} onClick={() => { setSelectedId(meeting.id); setReportOpen(false); }}>
                  <span className={`confidence grade-${meeting.confidence}`}>{meeting.confidence}</span>
                  <span className="meeting-main">
                    <span className="company-line"><strong>{meeting.company}</strong><small>{meeting.time}</small></span>
                    <span className="meeting-meta">{meeting.contact} · {meeting.title}</span>
                    <span className="row-foot"><em>{meeting.type}</em><span>{meeting.status}</span></span>
                  </span>
                  <span className="chevron">›</span>
                </button>
              ))}
              {visible.length === 0 && <div className="empty-state">一致する商談はありません</div>}
            </div>
          </div>

          <aside className="detail-panel" aria-live="polite">
            <div className="detail-head">
              <div>
                <div className="detail-kicker"><span className={`confidence grade-${selected.confidence}`}>{selected.confidence}</span>{selected.type}</div>
                <h2>{selected.company}</h2>
                <p>{selected.contact} · {selected.time} · {selected.duration}</p>
              </div>
              <div className="detail-actions"><button className="full-report-button" onClick={() => setReportOpen(true)}>詳細レポート</button><button className="dots" aria-label="その他の操作">···</button></div>
            </div>

            <div className="detail-tabs" role="tablist">
              {(["概要", "コーチング"] as const).map((item) => (
                <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>
              ))}
            </div>

            {tab === "概要" ? (
              <div className="detail-body">
                <section className="signal-card">
                  <div className="score-ring" style={{ "--score": `${selected.signal * 3.6}deg` } as React.CSSProperties}><span><strong>{selected.signal}</strong><small>商談シグナル</small></span></div>
                  <div><p>受注確度 {selected.confidence}</p><h3>{selected.status}</h3><span>発言内容と次の約束から判定</span></div>
                </section>
                <section className="detail-block">
                  <h3>要約</h3><p>{selected.summary}</p>
                </section>
                <section className="concern-block">
                  <span className="block-icon">!</span><div><small>最大の懸念</small><p>{selected.concern}</p></div>
                </section>
                <section className="next-card">
                  <div className="next-title"><span className="check-box" />次のアクション</div>
                  <h3>{selected.next}</h3>
                  <div className="next-meta"><span><small>担当</small>{selected.owner}</span><span><small>期限</small>{selected.due}</span></div>
                  <button>対応済みにする</button>
                </section>
                <section className="timeline">
                  <div className="section-title"><h3>商談の流れ</h3><button onClick={() => setTab("コーチング")}>振り返りを見る</button></div>
                  {selected.moments.map((moment) => (
                    <div className={`timeline-row ${moment.tone}`} key={`${selected.id}-${moment.time}`}><time>{moment.time}</time><i /><p>{moment.label}</p></div>
                  ))}
                </section>
              </div>
            ) : (
              <div className="detail-body coaching">
                <section className="coach-summary"><p>今回の商談</p><h3>良い流れを保ちながら、判断条件を一段深く聞く</h3><span>具体的な発言タイミングに基づくフィードバックです。</span></section>
                <section className="feedback good-feedback"><div className="feedback-title"><span>GOOD</span><h3>良かった点</h3></div>{selected.good.map((item) => <p key={item}>{item}</p>)}</section>
                <section className="feedback improve-feedback"><div className="feedback-title"><span>NEXT</span><h3>次に変える点</h3></div>{selected.improve.map((item) => <p key={item}>{item}</p>)}</section>
                <section className="talk-track"><small>次回のひと言</small><p>「社内で判断されるとき、最も重視されるのは費用、導入負荷、成果のどれでしょうか？」</p><button onClick={() => navigator.clipboard?.writeText("社内で判断されるとき、最も重視されるのは費用、導入負荷、成果のどれでしょうか？")}>コピー</button></section>
              </div>
            )}
          </aside>
          {reportOpen && (
            <section className="report-overlay" aria-label={`${selected.company} 詳細商談分析レポート`}>
              <header className="report-header">
                <button className="report-back" onClick={() => setReportOpen(false)}>‹ 一覧へ戻る</button>
                <div className="report-heading">
                  <div><p>商談分析レポート</p><h2>{selected.company}</h2><span>{selected.contact} · {selected.title} · {selected.time} · {selected.duration}</span></div>
                  <div className="report-grade"><span className={`confidence grade-${selected.confidence}`}>{selected.confidence}</span><div><small>受注確度</small><strong>{selected.status}</strong></div></div>
                </div>
              </header>

              <div className={selected.reportMarkdown ? "report-layout live-report-layout" : "report-layout"}>
                <nav className="report-nav" aria-label="レポート内ナビゲーション">
                  {[["01","基本情報"],["02","顧客の現状"],["03","課題・ニーズ"],["04","提案と反論"],["05","決定・次の一手"],["06","話の進め方"],["07","提案の改善"],["08","要確認"]].map(([number,label]) => <a key={number} href={`#report-${number}`}><span>{number}</span>{label}</a>)}
                </nav>

                <article className="report-document">
                  {selected.reportMarkdown ? (
                    <div className="markdown-report"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.reportMarkdown}</ReactMarkdown></div>
                  ) : (<>
                  <section id="report-01" className="report-section report-summary-section">
                    <div className="report-section-title"><span>01</span><div><small>OVERVIEW</small><h3>基本情報と総評</h3></div></div>
                    <div className="report-lead"><strong>{selected.confidence === "A" ? "成約に近い。残る判断材料を短くそろえる段階。" : selected.confidence === "B" ? "関心は高い。判断条件を具体化すれば次へ進める。" : "情報収集段階。課題の具体化からやり直す。"}</strong><p>{selected.summary}</p></div>
                    <div className="report-metrics"><div><small>商談シグナル</small><strong>{selected.signal}<em>/100</em></strong></div><div><small>最大の懸念</small><strong>{selected.concern}</strong></div><div><small>次の期限</small><strong>{selected.due}</strong></div></div>
                  </section>

                  <section id="report-02" className="report-section">
                    <div className="report-section-title"><span>02</span><div><small>CURRENT STATE</small><h3>顧客の現状</h3></div></div>
                    <div className="facts-table">{fullReport.facts.map(([label,value]) => <div key={label}><strong>{label}</strong><p>{value}</p></div>)}</div>
                  </section>

                  <section id="report-03" className="report-section">
                    <div className="report-section-title"><span>03</span><div><small>NEEDS</small><h3>課題・ニーズ</h3></div></div>
                    <ul className="report-list">{fullReport.needs.map((item,index) => <li key={item}><span>{String(index + 1).padStart(2,"0")}</span><p>{item}</p></li>)}</ul>
                  </section>

                  <section id="report-04" className="report-section">
                    <div className="report-section-title"><span>04</span><div><small>PROPOSAL & OBJECTIONS</small><h3>提案内容と懸念への切り返し</h3></div></div>
                    <div className="proposal-grid"><div><h4>提案した内容</h4>{fullReport.proposals.map(item => <p key={item}>{item}</p>)}</div><div><h4>提案の根拠</h4><p>顧客が明言した「{selected.concern}」を中心に、導入後の動きが具体化するよう提案。</p><p>次の判断に必要な費用・役割・期限を分けて整理する。</p></div></div>
                    <div className="objection-table"><div className="table-head"><span>顧客の懸念・質問</span><span>自社の回答・切り返し</span></div>{fullReport.objections.map(([q,a]) => <div className="table-row" key={q}><p>{q}</p><p>{a}</p></div>)}</div>
                  </section>

                  <section id="report-05" className="report-section">
                    <div className="report-section-title"><span>05</span><div><small>DECISIONS & NEXT ACTION</small><h3>決定事項とネクストアクション</h3></div></div>
                    <div className="decisions">{fullReport.decisions.map(item => <p key={item}><span>✓</span>{item}</p>)}</div>
                    <div className="action-table"><div><small>アクション</small><strong>{selected.next}</strong></div><div><small>担当</small><strong>{selected.owner}</strong></div><div><small>期限</small><strong>{selected.due}</strong></div></div>
                  </section>

                  <section id="report-06" className="report-section">
                    <div className="report-section-title"><span>06</span><div><small>PROCESS REVIEW</small><h3>話の進め方の振り返り</h3></div></div>
                    <div className="process-lead">全体として、相手の具体的な質問には丁寧に答えられている。一方で、判断条件を聞き切る前に説明へ進む場面があり、提案の順序を整える余地がある。良かった点を残しながら、次回は「誰が・何で・いつ判断するか」を先にそろえたい。</div>
                    <div className="report-timeline">{selected.moments.map((moment,index) => <div className={moment.tone} key={moment.time}><time>{moment.time}</time><span>{index + 1}</span><p>{moment.label}</p></div>)}</div>
                    <div className="coaching-grid">
                      <div className="coaching-column good-column"><h4><span>GOOD</span>良かった点</h4>{selected.good.map((item,index) => <article key={item}><small>{selected.moments[index]?.time ?? "—"}</small><h5>{item}</h5><p>相手の発言を受けて、その場で話を具体化できている。</p><blockquote>ここは良かったよ。相手の言葉を提案の根拠にできているので、この聞き方は次回も残そう。</blockquote></article>)}</div>
                      <div className="coaching-column next-column"><h4><span>NEXT</span>改善点</h4>{selected.improve.map((item,index) => <article key={item}><small>{selected.moments[index + 2]?.time ?? "終盤"}</small><h5>{item}</h5><p>判断に必要な情報がそろう前に、説明やクロージングへ進んでいる。</p><blockquote>こうした方がいいと思うよ。説明の前に判断基準を一つ質問し、その答えに合わせて話す順番を変えよう。</blockquote></article>)}</div>
                    </div>
                  </section>

                  <section id="report-07" className="report-section">
                    <div className="report-section-title"><span>07</span><div><small>PROPOSAL REVIEW</small><h3>提案内容の振り返りと代替案</h3></div></div>
                    <p className="section-intro">「提案が弱い」で終わらせず、次回そのまま使える説明順と比較材料へ置き換える。</p>
                    <div className="comparison-table"><div className="comparison-head"><span>観点</span><span>今回</span><span>次回の代替案</span><span>効果</span></div>{fullReport.comparison.map(row => <div className="comparison-row" key={row[0]}>{row.map((cell,index) => <p key={cell} className={index === 2 ? "recommended" : ""}>{cell}</p>)}</div>)}</div>
                    <div className="talk-order"><small>次回の話す順番</small><ol><li>相手の判断条件を確認</li><li>現状とのギャップを要約</li><li>選択肢を比較</li><li>根拠と数字を提示</li><li>担当・期限・次回判断を合意</li></ol></div>
                  </section>

                  <section id="report-08" className="report-section flag-section">
                    <div className="report-section-title"><span>08</span><div><small>VERIFY</small><h3>要確認フラグ</h3></div></div>
                    {fullReport.flags.map(item => <p key={item}><span>!</span>{item}</p>)}
                  </section>
                  </>)}
                </article>
              </div>
            </section>
          )}
        </section>

        <footer className="data-note"><span>{syncedMeetings.length ? "LIVE DATA" : "DEMO DATA"}</span> {syncedMeetings.length ? `Nottaの分析結果を自動同期しています${lastSyncedAt ? ` · 最終同期 ${new Date(lastSyncedAt).toLocaleString("ja-JP")}` : ""}` : "この画面の会社名・担当者名はすべて架空です。"}</footer>
      </section>
    </main>
  );
}
