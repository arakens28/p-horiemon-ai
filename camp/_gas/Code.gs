/**
 * 1日Camp 申込フロー
 *   doPost : LPの申込ボタン（?click=1）→ クリックログに流入元を記録
 *            Square Webhook → Slack通知 + サンクスメール + 申込ログ
 *   doGet  : 旧方式（押すたびに決済リンクを発行）。今のLPは使っていない
 *
 * LPの申込ボタンは、Squareの管理画面で作った「何度でも使える決済リンク」へ直接飛ぶ。
 * そのリンクの注文には流入元を付けられないので、クリック時刻と日程で突き合わせる。
 *
 * スプレッドシートに紐づいた Apps Script として使う。
 * スクリプトプロパティ:
 *   SQUARE_TOKEN       Square 開発者アプリの本番アクセストークン
 *   SLACK_WEBHOOK_URL  荒木宛て Slack Incoming Webhook URL
 *   WEBHOOK_KEY        Webhook URL の ?key= に付ける合言葉（setup() で自動生成）
 */

const SQUARE_API = 'https://connect.squareup.com/v2';
const LOCATION_ID = 'LTN9K50E82WN8';
const THANKS_URL = 'https://p.horiemon.ai/camp/thanks.html';
const LOG_SHEET = '申込ログ';
const CLICK_SHEET = 'クリックログ';
const CLICK_HEADER = ['クリック日時', '日程ID', '流入元', '対応する支払いID'];
const CLICK_MATCH_MINUTES = 120; // 決済のこの分数前までのクリックを同じ人とみなす
const LOG_HEADER = ['受信日時', '支払いID', '日程', '氏名', 'メール', '金額', 'サンクスメール', '流入元'];
const SOURCE_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'click_id', 'ref', 'landing'];
const CHATWORK_ATTR_NAME = 'Chatwork招待URL';
const SENDER_NAME = 'ホリエモンAI学校 1日Camp事務局';

// 初回だけ手動で実行する。ログシートと WEBHOOK_KEY を用意する。
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WEBHOOK_KEY')) {
    props.setProperty('WEBHOOK_KEY', Utilities.getUuid().replace(/-/g, ''));
  }
  logSheet_();
  Logger.log('WEBHOOK_KEY = ' + props.getProperty('WEBHOOK_KEY'));
}

// LPの申込ボタンから fetch で呼ばれる。決済リンクのURLをJSONで返す。
// Squareの決済リンクは1回売れると使えなくなるため、押されるたびに新しく作る。
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (!p.v) return json_({ error: 'not_found' });
    const res = square_('GET', '/catalog/object/' + encodeURIComponent(p.v) + '?include_related_objects=true');
    const item = (res.related_objects || []).filter(function (o) { return o.type === 'ITEM'; })[0];
    if (!res.object || res.object.type !== 'ITEM_VARIATION' || !item || item.item_data.product_type !== 'EVENT') {
      return json_({ error: 'not_found' });
    }
    if (remaining_(p.v, LOCATION_ID) === 0) return json_({ error: 'sold_out' });

    const metadata = {};
    SOURCE_KEYS.forEach(function (k) {
      if (p[k]) metadata[k] = String(p[k]).slice(0, 255);
    });
    const order = { location_id: LOCATION_ID, line_items: [{ catalog_object_id: p.v, quantity: '1' }] };
    if (Object.keys(metadata).length) order.metadata = metadata;
    const link = square_('POST', '/online-checkout/payment-links', {
      idempotency_key: Utilities.getUuid(),
      payment_note: item.item_data.name.replace(/^ホリエモンAI学校/, ''),
      order: order,
      checkout_options: { redirect_url: THANKS_URL },
    }).payment_link;
    return json_({ url: link.url });
  } catch (err) {
    notifySlack_(':warning: 1日Campの決済リンク発行でエラーが出ました\nv: ' + p.v + '\n' + err);
    return json_({ error: 'failed' });
  }
}

function doPost(e) {
  if (e && e.parameter && e.parameter.click === '1') {
    logClick_(e.parameter);
    return ok_();
  }
  const props = PropertiesService.getScriptProperties();
  if (!e || !e.parameter || e.parameter.key !== props.getProperty('WEBHOOK_KEY')) return ok_();

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ok_();
  }
  const payment = body && body.data && body.data.object && body.data.object.payment;
  if (!payment || payment.status !== 'COMPLETED') return ok_();

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (!alreadyHandled_(payment.id)) handlePayment_(payment.id);
  } catch (err) {
    notifySlack_(':warning: 1日Camp申込の処理でエラーが出ました\npayment: ' + payment.id + '\n' + err);
  } finally {
    lock.releaseLock();
  }
  return ok_();
}

// 動作確認用。Square の支払いIDを入れて手動実行すると、本番と同じ処理を流す。
function testWithPaymentId() {
  const paymentId = 'ここに支払いID';
  handlePayment_(paymentId);
}

function handlePayment_(paymentId) {
  // Webhook の中身は信用せず、Square から取り直して本物か確かめる
  const payment = square_('GET', '/payments/' + paymentId).payment;
  if (!payment || payment.status !== 'COMPLETED') return;

  const order = square_('GET', '/orders/' + payment.order_id).order;
  const line = (order.line_items || [])[0];
  if (!line || !line.catalog_object_id) return;

  const variation = square_('GET', '/catalog/object/' + line.catalog_object_id + '?include_related_objects=true');
  const item = (variation.related_objects || []).filter(function (o) { return o.type === 'ITEM'; })[0];
  // Camp のチケット以外（会費など）は対象外
  if (!item || !item.item_data || item.item_data.product_type !== 'EVENT') return;

  const camp = campInfo_(item);
  const buyer = buyerInfo_(payment);
  const remaining = remaining_(line.catalog_object_id, order.location_id);
  const meta = order.metadata || {};
  const source = Object.keys(meta).length
    ? sourceLabel_(meta)
    : matchClick_(line.catalog_object_id, new Date(payment.created_at), payment.id);

  if (buyer.email) sendThanksMail_(buyer, camp);

  appendLog_([new Date(), payment.id, camp.label, buyer.name, buyer.email, payment.amount_money.amount,
    camp.chatworkUrl ? '送信済み' : '送信済み（招待URLなし）', source]);

  const lines = [
    ':tada: 1日Camp に申込みがありました',
    '日程：' + camp.label,
    '氏名：' + (buyer.name || '（不明）'),
    'メール：' + (buyer.email || '（不明）'),
    '金額：¥' + Number(payment.amount_money.amount).toLocaleString(),
    '残り枠：' + (remaining === null ? '不明' : remaining + '枠'),
    '流入元：' + source,
  ];
  if (!buyer.email) lines.push(':warning: メールアドレスが取れなかったため、サンクスメールは未送信です');
  if (!camp.chatworkUrl) lines.push(':warning: この日程のChatwork招待URLが未設定です。個別に案内してください');
  notifySlack_(lines.join('\n'));
}

function campInfo_(item) {
  const d = item.item_data;
  const ev = d.event || {};
  const online = (ev.event_location_types || []).indexOf('IN_PERSON') === -1;
  const venueMatch = (d.description || '').match(/対面開催・([^）]+)）/);
  // チケット説明文の「1日Camp ○○編」から回の名前を取る（Codex回とClaude Code回でメール文面を変えるため）
  const editionMatch = (d.description || '').match(/1日Camp\s*([^（(]+?編)/);

  let chatworkUrl = '';
  const attrs = item.custom_attribute_values || {};
  Object.keys(attrs).forEach(function (k) {
    if (attrs[k].name === CHATWORK_ATTR_NAME && attrs[k].string_value) chatworkUrl = attrs[k].string_value;
  });

  return {
    label: d.name.replace(/^ホリエモンAI学校1日Camp\s*/, ''),
    online: online,
    venue: venueMatch ? venueMatch[1] : '',
    edition: editionMatch ? editionMatch[1] : 'Claude Code/Cowork編',
    dateText: ev.start_at ? formatRange_(ev.start_at, ev.end_at) : '',
    chatworkUrl: chatworkUrl,
  };
}

// 注文に記録した流入元を、人が読める1行にする
function sourceLabel_(m) {
  if (m.utm_source) {
    let s = [m.utm_source, m.utm_medium, m.utm_campaign].filter(Boolean).join(' / ');
    if (m.utm_content) s += '（' + m.utm_content + '）';
    return s;
  }
  if (m.click_id) return m.click_id + '経由の広告（UTMなし）';
  if (m.ref) return '参照元：' + m.ref;
  if (m.landing) return '直接（ブックマーク・メールアプリ等）';
  return '不明（流入元を記録する前のリンク）';
}

// LPの申込ボタンが押されたときに、日程と流入元を記録する
function logClick_(p) {
  if (!p.v) return;
  const m = {};
  SOURCE_KEYS.forEach(function (k) { if (p[k]) m[k] = String(p[k]).slice(0, 255); });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    clickSheet_().appendRow([new Date(), String(p.v).slice(0, 64), JSON.stringify(m), '']);
  } finally {
    lock.releaseLock();
  }
}

// 支払いの直前に同じ日程のボタンを押したクリックを探し、その流入元を返す（使ったクリックには印を付ける）
function matchClick_(variationId, paidAt, paymentId) {
  const sh = clickSheet_();
  const last = sh.getLastRow();
  if (last < 2) return '不明（クリック記録なし）';
  const from = Math.max(2, last - 499);
  const rows = sh.getRange(from, 1, last - from + 1, 4).getValues();
  const limit = CLICK_MATCH_MINUTES * 60 * 1000;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const t = r[0] instanceof Date ? r[0].getTime() : NaN;
    if (r[1] !== variationId || r[3] || !(t <= paidAt.getTime()) || paidAt.getTime() - t > limit) continue;
    sh.getRange(from + i, 4).setValue(paymentId);
    let m = {};
    try { m = JSON.parse(r[2] || '{}'); } catch (err) {}
    return sourceLabel_(m) + '（クリック時刻で推定）';
  }
  return '不明（直前のクリック記録なし）';
}

function clickSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CLICK_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CLICK_SHEET);
    sh.appendRow(CLICK_HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

function buyerInfo_(payment) {
  const addr = payment.billing_address || payment.shipping_address || {};
  const name = [addr.last_name, addr.first_name].filter(Boolean).join(' ');
  return { name: name, email: payment.buyer_email_address || '' };
}

function remaining_(variationId, locationId) {
  try {
    const res = square_('POST', '/inventory/counts/batch-retrieve', {
      catalog_object_ids: [variationId],
      location_ids: [locationId],
      states: ['IN_STOCK'],
    });
    const c = (res.counts || [])[0];
    return c ? Number(c.quantity) : 0;
  } catch (err) {
    return null;
  }
}

function sendThanksMail_(buyer, camp) {
  const subject = '【ホリエモンAI学校】1日Camp お申込み完了のご案内（' + camp.label + '）';
  const place = camp.online
    ? 'オンライン（全国から参加可能）'
    : '対面' + (camp.venue ? '（会場：' + camp.venue + '）' : '');

  const groupBlock = camp.chatworkUrl
    ? [
      '▼ まずは参加者用のChatworkグループにご参加ください',
      camp.chatworkUrl,
      '',
      '当日の' + (camp.online ? '参加URLや' : '集合案内や') + '事前準備のご案内は、このグループでお送りします。',
      '※Chatworkのアカウントをお持ちでない方も、上のURLから無料で登録できます。',
    ]
    : [
      '▼ 参加者用Chatworkグループのご案内',
      '参加用のURLは、追って事務局よりお送りします。今しばらくお待ちください。',
    ];

  const body = [
    (buyer.name ? buyer.name + ' 様' : 'お申込みいただいた皆さま'),
    '',
    'このたびは、ホリエモンAI学校「1日Camp ' + camp.edition + '」にお申込みいただき、誠にありがとうございます。',
    '以下の内容でお申込みを承りました。',
    '',
    '■ 開催日時：' + camp.dateText,
    '■ 形式：' + place,
    '',
  ].concat(groupBlock).concat([
    '',
    'ご不明な点があれば、このメールにそのままご返信ください。',
    '当日お会いできるのを楽しみにしております。',
    '',
    '――――――――――――――――',
    SENDER_NAME,
    'https://p.horiemon.ai/camp/',
  ]).join('\n');

  GmailApp.sendEmail(buyer.email, subject, body, { name: SENDER_NAME });
}

function formatRange_(startIso, endIso) {
  const tz = 'Asia/Tokyo';
  const s = new Date(startIso);
  const youbi = ['日', '月', '火', '水', '木', '金', '土'][Number(Utilities.formatDate(s, tz, 'u')) % 7];
  let text = Utilities.formatDate(s, tz, 'yyyy年M月d日') + '(' + youbi + ') ' + Utilities.formatDate(s, tz, 'H:mm');
  if (endIso) text += '〜' + Utilities.formatDate(new Date(endIso), tz, 'H:mm');
  return text;
}

function square_(method, path, payload) {
  const options = {
    method: method,
    headers: {
      Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('SQUARE_TOKEN'),
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };
  if (payload) options.payload = JSON.stringify(payload);
  const res = UrlFetchApp.fetch(SQUARE_API + path, options);
  if (res.getResponseCode() >= 300) throw new Error('Square ' + path + ' ' + res.getResponseCode() + ' ' + res.getContentText());
  return JSON.parse(res.getContentText());
}

function notifySlack_(text) {
  const url = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  if (!url) return;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text: text }),
    muteHttpExceptions: true,
  });
}

function logSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(LOG_HEADER);
    sh.setFrozenRows(1);
  } else if (sh.getRange(1, LOG_HEADER.length).getValue() === '') {
    // 列を後から足したとき、既存シートの見出しをそろえる
    sh.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]);
  }
  return sh;
}

function alreadyHandled_(paymentId) {
  const sh = logSheet_();
  const last = sh.getLastRow();
  if (last < 2) return false;
  return sh.getRange(2, 2, last - 1, 1).getValues().some(function (r) { return r[0] === paymentId; });
}

function appendLog_(row) {
  logSheet_().appendRow(row);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Square には 302 ではなく 200 を返す必要があるため HtmlService で応答する
function ok_() {
  return HtmlService.createHtmlOutput('ok');
}
