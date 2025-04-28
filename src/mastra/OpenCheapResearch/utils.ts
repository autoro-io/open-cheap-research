import fs from 'fs';
import path from 'path';
import { createLogger } from '@mastra/core/logger';

const workspaceDirectory = process.env.WORKSPACE_DIR || './workspace';

const consoleLogger = createLogger({
  name: 'mastra',
  level: 'info',
});

export function writeOutputToFile(output: string, filename: string) {
  const filePath = path.join(workspaceDirectory, filename);
  // Create the directory if it doesn't exist
  if (!fs.existsSync(workspaceDirectory)) {
    fs.mkdirSync(workspaceDirectory, { recursive: true });
  }
  fs.writeFileSync(filePath, output);
}

export function addOutputToFile(output: string, filename: string) {
  const filePath = path.join(workspaceDirectory, filename);
  // Create the directory if it doesn't exist
  if (!fs.existsSync(workspaceDirectory)) {
    fs.mkdirSync(workspaceDirectory, { recursive: true });
  }
  fs.appendFileSync(filePath, output);
}

// バッチ処理のためのユーティリティ関数
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // バッチ間に少し待機を入れる（APIレート制限対策）
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

function extractCodeBlockContent(markdown: string | null): string {
  if (!markdown) {
    return "";
  }
  const match = markdown.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```/);
  return match ? match[1].trim() : markdown;
}

export { workspaceDirectory, consoleLogger, extractCodeBlockContent };