/**
 * AIO参入支援LP(p.horiemon.ai/aio/)の資料請求フォーム受信用スクリプト
 *
 * 使い方:
 * 1. sheets.new で新しいスプレッドシートを作成し、URLの /d/ と /edit の間の文字列(シートID)をコピー
 * 2. スプレッドシートの「拡張機能」→「Apps Script」を開く
 * 3. このファイルの中身を貼り付け、SHEET_ID と NOTIFY_EMAIL を書き換える
 *    （NOTIFY_EMAILは複数登録する場合、カンマ区切りで並べる）
 * 4. 「デプロイ」→「新しいデプロイ」→ 種類:ウェブアプリ
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 5. 発行された https://script.google.com/.../exec のURLを、
 *    aio/index.html の DOC_FORM_ENDPOINT に設定する
 *
 * コードを書き換えた後は、既存デプロイの場合「デプロイ」→「デプロイを管理」→
 * 鉛筆マーク→バージョン「新しいバージョン」→デプロイ、で反映する（URLは変わらない）
 */

const SHEET_ID = 'ここにスプレッドシートIDを入力';
const NOTIFY_EMAIL = 'ここに通知先メールアドレスを入力（複数の場合はカンマ区切り）';
const DOCUMENT_URL = 'https://drive.google.com/file/d/1wJJZIXXco_4A7wskW-Cm776lh1KDCQA9/view?usp=sharing';

function doPost(e) {
  const params = e.parameter;
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
