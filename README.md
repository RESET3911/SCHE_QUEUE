# Sche Queue

Googleカレンダーに予定を素早く投げ込むための入力専用Webアプリ。
「いつ」「何をするか」だけ決めれば、カテゴリ・サブカテゴリがタイトル整形・色・通知・登録先・共有範囲をすべて自動決定する。

## 技術構成

- Vite + React + TypeScript + Tailwind CSS（完全クライアントサイド、サーバー不要）
- 認証: Google Identity Services（トークンフロー）
- カレンダー連携: Google Calendar API v3（REST）
- 設定保存: localStorage（クライアントID・カレンダー紐付け・サブカテゴリ）

> 仕様書では Next.js / Supabase 想定だったが、他のSTアプリ群と同じ
> 静的SPA構成（GitHub Pagesデプロイ可・DB不要）に変更している。

## 初回セットアップ（Google側）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス > ライブラリ」で **Google Calendar API** を有効化
3. 「APIとサービス > OAuth同意画面」を設定（テストユーザーに自分のGoogleアカウントを追加）
4. 「認証情報 > 認証情報を作成 > OAuthクライアントID」で種類「**ウェブアプリケーション**」を作成
5. 「承認済みのJavaScript生成元」に以下を追加
   - `http://localhost:5173`（開発用）
   - 本番URL（GitHub Pages等にデプロイした場合）
6. 発行されたクライアントID（`xxxx.apps.googleusercontent.com`）をアプリの設定画面に貼り付けて「Googleに接続」
7. 設定画面で「自分用」「ファミリー」カレンダーをそれぞれ紐付け

## 開発

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # 型チェック + dist/ 出力
```

## 使い方

- **タイムラインをタップ** → 30分枠を作成 / **長押し** → 1時間枠を作成
- 枠はドラッグで移動、下端ハンドルで長さ変更（15分刻み）
- 上部の**大カテゴリボタン**からは「直近の30分区切り」に枠を作って即シートを開く
- サブカテゴリを選ぶと接頭辞・色・通知・登録先が自動反映（登録先・通知は手動上書き可）
- 保存後6秒間はスナックバーの「取り消す」で削除可能

## MVP実装状況

仕様書 7.1 の全項目を実装済み。v1.1機能（クイック入力・繰り返し・定型予定・
確認シートスキップ・時間帯による並び替え）は未実装。
