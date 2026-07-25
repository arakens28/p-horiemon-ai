/**
 * フォーム受信用スクリプト（統合版）
 * - AIO参入支援LP(p.horiemon.ai/aio/)の資料請求フォーム
 * - エグゼクティブAI研修LP(exec-ai-lp-b316cd9b.vercel.app)の問い合わせフォーム
 * - パートナー募集LP(p.horiemon.ai/partner/)の資料DLフォーム
 * を1つの doPost で受信する。hidden項目 form=exec-ai / form=partner-doc の有無で振り分け。
 *
 * 反映方法（コードを書き換えたとき）:
 * 「デプロイ」→「デプロイを管理」→ 鉛筆マーク → バージョン「新しいバージョン」→ デプロイ
 * （URLは変わらない。「新しいデプロイ」を選ぶと別URLになるので注意）
 *
 * ※ SHEET_ID と NOTIFY_EMAIL はGoogle側エディタの実物の値を残すこと
 */

const SHEET_ID = '1p3oLfvJclqAoq3S20RM_4i2BsyYtIpGGXIwhhRsh6lg';
const EXEC_SHEET_ID = '1NvpFa-9yaMaoVxQB_OHHNmhSjoePDRi9QhXAr_5tCu0'; // エグゼクティブAI研修LP用スプシ
const NOTIFY_EMAIL = 'araki+aio@telewor.com,kazuma@kingprotea.jp,arakens28@gmail.com';
const EXEC_NOTIFY_EMAIL = 'araki@telewor.com'; // 研修LPの通知先（AIOとは別）
const DOCUMENT_URL = 'https://drive.google.com/file/d/1wJJZIXXco_4A7wskW-Cm776lh1KDCQA9/view?usp=sharing';
const REPLY_TO_EMAIL = 'kazuma@kingprotea.jp';
const SENDER_NAME = 'ホリエモンAI学校';

// ===== パートナー募集LP用の設定 =====
const PARTNER_NOTIFY_EMAIL = 'araki@telewor.com'; // パートナー募集LPの通知先
const PARTNER_REPLY_TO = 'araki@telewor.com';
const PARTNER_DOCUMENT_URL = 'https://docs.google.com/presentation/d/1XVgmBOi1Xl3SqFfUitJNMHI_YZVeU4TNIIysOzdk7cw/edit?usp=sharing'; // パートナー募集資料

function doPost(e) {
  const params = e.parameter;

  // エグゼクティブAI研修LPからの問い合わせ
  if (params['form'] === 'exec-ai') {
    return handleExecAi(params);
  }

  // パートナー募集LPの資料DL・お問い合わせ（統合フォーム）
  if (params['form'] === 'partner-doc') {
    return handlePartnerDoc(params);
  }

  // ここから下は従来どおりAIOの資料請求
  return handleAioDocRequest(params);
}

// ===== パートナー募集LP 資料DL・お問い合わせ（統合フォーム） =====
function handlePartnerDoc(params) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetName = '資料請求_パートナー募集';
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['送信日時', '会社名', 'お名前', 'メールアドレス', 'お問い合わせ内容']);
  }

  const company = params['company'] || '';
  const name = params['name'] || '';
  const email = params['email'] || '';
  const message = params['message'] || '';

  sheet.appendRow([new Date(), company, name, email, message]);

  // 社内通知メール
  MailApp.sendEmail({
    to: PARTNER_NOTIFY_EMAIL,
    subject: '【パートナー募集LP】資料請求・お問い合わせ: ' + (company || '会社名未記入'),
    body:
      '会社名: ' + company + '\n' +
      'お名前: ' + name + '\n' +
      'メールアドレス: ' + email + '\n\n' +
      'お問い合わせ内容:\n' + (message || '(未入力・資料請求のみ)') + '\n\n' +
      '送信日時: ' + new Date()
  });

  // 申込者への自動返信メール
  if (email) {
    MailApp.sendEmail({
      to: email,
      replyTo: PARTNER_REPLY_TO,
      name: SENDER_NAME,
      subject: '【ホリエモンAI学校】業界特化AIパートナー資料のご請求ありがとうございます',
      body:
        (company ? company + '\n' : '') +
        name + ' 様\n\n' +
        'この度は「業界特化AI 活用推進パートナー」の資料をご請求いただき、誠にありがとうございます。\n\n' +
        (PARTNER_DOCUMENT_URL
          ? '下記URLより資料をご覧いただけます。\n\n' + PARTNER_DOCUMENT_URL + '\n\n'
          : '担当者より2営業日以内に、資料をメールでお送りいたします。\n\n') +
        'お急ぎの場合や、30分オンライン面談をご希望の場合は、下記よりご予約いただけます。\n' +
        'https://app.spirinc.com/t/IytyMZnmYA7-kjfN9wcz9/as/gn6hwEwlXgPWc-8-pPJKu/confirm\n\n' +
        'ご不明点がございましたら、お気軽にご返信ください。\n\n' +
        '--------------------\n' +
        'ホリエモンAI学校株式会社\n'
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== エグゼクティブAI研修LP =====
function handleExecAi(params) {
  const ss = SpreadsheetApp.openById(EXEC_SHEET_ID);
  const sheet = ss.getSheets()[0];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['送信日時', '会社名', 'お名前', 'メールアドレス', 'ご相談内容']);
  }

  const company = params['company'] || '';
  const name = params['name'] || '';
  const email = params['email'] || '';
  const message = params['message'] || '';

  sheet.appendRow([new Date(), company, name, email, message]);

  MailApp.sendEmail({
    to: EXEC_NOTIFY_EMAIL,
    subject: '【エグゼクティブAI研修LP】お問い合わせ: ' + (company || '会社名未記入'),
    body:
      '会社名: ' + company + '\n' +
      'お名前: ' + name + '\n' +
      'メールアドレス: ' + email + '\n\n' +
      'ご相談内容:\n' + (message || '(未入力)') + '\n\n' +
      '送信日時: ' + new Date()
  });

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== AIO資料請求（従来どおり） =====
function handleAioDocRequest(params) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetName = '資料請求_AIO';
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['送信日時', '会社名', 'お名前', 'メールアドレス', '電話番号']);
  }

  const company = params['会社名'] || '';
  const name = params['お名前'] || '';
  const email = params['メールアドレス'] || '';
  const tel = params['電話番号'] || '';

  sheet.appendRow([new Date(), company, name, email, tel]);

  // 社内通知メール
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: '【AIO参入支援LP】資料請求がありました',
    body:
      '会社名: ' + company + '\n' +
      'お名前: ' + name + '\n' +
      'メールアドレス: ' + email + '\n' +
      '電話番号: ' + (tel || '(未入力)') + '\n\n' +
      '送信日時: ' + new Date()
  });

  // 申込者への自動返信メール（資料URL付き）
  if (email) {
    MailApp.sendEmail({
      to: email,
      replyTo: REPLY_TO_EMAIL,
      name: SENDER_NAME,
      subject: '【ホリエモンAI AIO】資料請求ありがとうございます',
      body:
        (company ? company + '\n' : '') +
        name + ' 様\n\n' +
        'この度は「ホリエモンAI AIO」へ資料請求をいただき、誠にありがとうございます。\n' +
        '下記URLより資料をご覧いただけます。\n\n' +
        DOCUMENT_URL + '\n\n' +
        'ご不明点やご相談がございましたら、お気軽にご返信ください。\n' +
        '担当者より改めてご連絡させていただく場合がございます。\n\n' +
        '--------------------\n' +
        'ホリエモンAI学校株式会社\n' +
        '（AIO対策パートナー：株式会社キングプロテア）\n'
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
