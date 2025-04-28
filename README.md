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

## チープリサーチ起動

```
$ npx tsx ./src/mastra/cli.ts
```


## 起動（Mastra）

npm の導入方法は、勝手に調べて入れて欲しい。

```sh
$ npm install
$ npm run dev
```

あとは、UI見るなりして使う。

# 説明

### **/workspace** フォルダ

エージェントの中間アウトプットなどをファイルに保存するもの。実行中は、メモリに展開しているので、書き込むだけで再度読み込むことはない。ログ。ゴミ。

