import { Mastra } from '@mastra/core/mastra';
import readline from 'readline';
import { CheapResearchAgent } from './OpenCheapResearch/agents';
import { Memory } from '@mastra/memory';
import { LangfuseExporter } from "langfuse-vercel";
import { createLogger } from '@mastra/core/logger';
import dotenv from 'dotenv';
import path from 'path';

// .env.developmentファイルを読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

// Mastra SDKを初期化
const mastra = new Mastra({
    agents: {
        CheapResearchAgent,
    },
    telemetry: {

        serviceName: 'ai',
        enabled: true,
        export: {
            type: "custom",
            exporter: new LangfuseExporter({
                publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
                secretKey: process.env.LANGFUSE_SECRET_KEY!,
                baseUrl: process.env.LANGFUSE_BASEURL!,
            }),
        },
    },
    logger: createLogger({
        name: 'mastra',
        level: 'info',
    }),
});

// コマンドラインでの対話インターフェースを作成
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log(`Cheap Research Agent とのチャットを開始します。終了するには 'exit' と入力してください。`);
const agent = mastra.getAgent('CheapResearchAgent');

async function chatLoop() {
    rl.question('あなた: ', async (userInput) => {
        if (userInput.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        try {
            // エージェントを取得

            // ストリーミングでチャットを実行
            const stream = await agent.stream(
                [{ role: 'user', content: userInput }],
            );

            process.stdout.write('エージェント: ');
            // ストリームからチャンクを読み取り、逐次表示
            for await (const chunk of stream.textStream) {
                // 各チャンクのコンテンツを取得して表示
                // chunk.choices[0]?.delta?.content が存在する場合のみ出力
                process.stdout.write(chunk);
            }
            process.stdout.write('\n'); // 応答の最後に改行を追加

        } catch (error) {
            process.stdout.write(`\nエラーが発生しました ${error}`);
            // エラーによってはリトライや終了処理を追加できます
        }

        // 次の入力を待つためにループを再帰呼び出し
        chatLoop();
    });
}

// 最初の質問を促す
chatLoop();

// readlineインターフェースが閉じられたときの処理
rl.on('close', () => {
    console.log('\nチャットを終了します。');
    process.exit(0);
});