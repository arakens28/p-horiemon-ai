/**
 * AIO参入支援LP(p.horiemon.ai/aio/)の資料請求フォーム受信用スクリプト
 *
 * 使い方:
 * 1. sheets.new で新しいスプレッドシートを作成し、URLの /d/ と /edit の間の文字列(シートID)をコピー
 * 2. スプレッドシートの「拡張機能」→「Apps Script」を開く
 * 3. このファイルの中身を貼り付け、SHEET_ID と NOTIFY_EMAIL を書き換える
 * 4. 「デプロイ」→「新しいデプロイ」→ 種類:ウェブアプリ
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 5. 発行された https://script.google.com/.../exec のURLを、
 *    aio/index.html の DOC_FORM_ENDPOINT に設定する
 */

const SHEET_ID = 'ここにスプレッドシートIDを入力';
const NOTIFY_EMAIL = 'ここに通知先メールアドレスを入力';

function doPost(e) {
  const params = e.parameter;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetName = '資料請求_AIO';
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['送信日時', '会社名', 'お名前', 'メールアドレス', '電話番号']);
  }

  sheet.appendRow([
    new Date(),
    params['会社名'] || '',
    params['お名前'] || '',
    params['メールアドレス'] || '',
    params['電話番号'] || ''
  ]);

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: '【AIO参入支援LP】資料請求がありました',
    body:
      '会社名: ' + (params['会社名'] || '') + '\n' +
      'お名前: ' + (params['お名前'] || '') + '\n' +
      'メールアドレス: ' + (params['メールアドレス'] || '') + '\n' +
      '電話番号: ' + (params['電話番号'] || '(未入力)') + '\n\n' +
      '送信日時: ' + new Date()
  });

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
