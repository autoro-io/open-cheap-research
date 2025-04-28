# 何をするものか？

Mastra の学習用使い捨てプログラムです。チープリサーチというディープリサーチのコピーを作成してみました。
中身の設計については、 `./src/mastra/OpenCheapResearch/README.md` を参照してください。

# 使い方

## APIキーの設定

`.env.example` を `.env.development` に名前を変えて各種必要なキーを設定

```
OPENAI_API_KEY=
SERPAPI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASEURL=
```

## インストール

```
$ pnpm install
```

## チープリサーチ起動

```
$ npx tsx ./src/mastra/cli.ts
```

## **/workspace** フォルダ

* エージェントの中間アウトプットなどをファイルに保存するものです
* 実行中は、メモリに展開しているので、書き込むだけで再度読み込むことありません
* 毎回同じファイル名で出力されるので、二回目には上書きされます

最終成果物は、コンソールに表示される他、`final_report.md` として出力されます。

# Mastra

## 起動（Mastra）

```sh
$ pnpm install
$ pnpm run dev
```


