import { Workflow, Step } from "@mastra/core/workflows";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  outlineWriterAgent,
  createOutlineWriterPrompt,
  outlineReflectionAgent,
  createOutlineReflectionPrompt,
  createFeedbackPrompt,
  chapterParserAgent,
  phaseJudgeAgent,
  createPhaseJudgePrompt,
  contentWriterAgent,
  createContentWriterPrompt,
  contentReflectionAgent,
  finalReportWriterAgent,
  finalReportReflectionAgent,
  createFinalReportWriterPrompt,
  createContentReflectionPrompt,
  createFinalReportReflectionPrompt,
} from "./agents";
import {
  addOutputToFile,
  consoleLogger,
  extractCodeBlockContent,
  writeOutputToFile,
} from "./utils";
 
const MAX_RETRIES = 2;
// Step 1: Outline
const outlineStep = new Step({
  id: "Outline-Writer-Step",
  inputSchema: z.object({
    query: z.string().describe("Research request from the user"),
  }),
  outputSchema: z.string().describe("Outline in markdown format"),
  execute: async ({ context }) => {
    consoleLogger.info(`🏃🏻 Executing Outline Writer Step`);
    // Trial count
    let count = 0;
    const maxRetries = MAX_RETRIES;

    // judgement from the judge agent
    let judge: "proceed" | "revise" = "revise";

    let result = "";

    writeOutputToFile("", "outline.md");

    // Outline revision loop
    let query = context.triggerData.query;
    consoleLogger.info(`Outline query: ${query}`);

    while (count < maxRetries && judge === "revise") {
      const prompt = createOutlineWriterPrompt(query);
      const response = await outlineWriterAgent.generate(prompt);
      consoleLogger.info(
        `✈️ Outline generated (${count + 1}): \n${response.text}`
      );
      // Write the outline to a file
      addOutputToFile(
        `\n\n==== trial ${count + 1} ====\n\n${response.text}`,
        "outline.md"
      );
      // Get feedback from the reflection agent
      const feedbackPrompt = createOutlineReflectionPrompt(response.text);
      const feedbackResponse =
        await outlineReflectionAgent.generate(feedbackPrompt);
      consoleLogger.info(
        `✈️ Outline feedback (${count + 1}): \n${feedbackResponse.text}`
      );
      addOutputToFile(
        `\n\n==== feedback ${count + 1} ====\n\n${feedbackResponse.text}`,
        "outline.md"
      );
      // Get judgement from the judge agent
      const judgePrompt = createPhaseJudgePrompt(
        "outline",
        response.text,
        feedbackResponse.text
      );
      const judgeResponse = await phaseJudgeAgent.generate(judgePrompt);
      consoleLogger.info(
        `✈️ Outline judgement (${count + 1}): \n${judgeResponse.text}`
      );
      try {
        const judgeResult = JSON.parse(
          extractCodeBlockContent(judgeResponse.text)
        );
        judge = judgeResult.action;
        if (judge === "revise") {
          const reason = judgeResult.reason;
          consoleLogger.info(
            `✈️ Outline revision reason (${count + 1}): \n${reason}`
          );
          addOutputToFile(
            `\n\n==== revision reason ${count + 1} ====\n\n${reason}`,
            "outline.md"
          );
          const userQuery = context.inputData.query;
          const newQuery = createFeedbackPrompt(
            userQuery,
            result,
            feedbackResponse.text
          );
          query = newQuery;
        }
        result = response.text;
      } catch (error) {
        consoleLogger.error(
          `Error parsing judgement response: ${judgeResponse.text}`
        );

        // Fallback to default behaviour
        judge = "proceed";
        result = response.text;
      }
      count++;
    }
    if (judge === "revise") {
      consoleLogger.error("Outline revision failed after maximum retries.");
    }
    // Write the final outline to a file
    addOutputToFile(`==== final outline ====\n\n${result}`, "outline.md");
    return result;
  },
});

const chapterParserStep = new Step({
  id: "Chapter-Parser-Step",
  inputSchema: z.object({
    outline: z.string().describe("Outline in markdown format"),
  }),
  outputSchema: z.object({
    chapters: z.array(
      z.object({
        number: z.number().describe("Chapter number"),
        title: z.string().describe("Chapter title"),
        description: z.string().describe("Chapter description"),
      })
    ),
  }),
  execute: async ({ context }) => {
    consoleLogger.info("🏃🏻‍♀️ Executing Chapter Parser Step");
    const outline = context.getStepResult(outlineStep);
    const response = await chapterParserAgent.generate(outline);
    consoleLogger.info(`✈️ Chapter parsed: \n${response.text}`);
    // Write the parsed chapters to a file
    addOutputToFile(
      `\n\n==== parsed chapters ====\n\n${response.text}`,
      "chapters.json"
    );
    return JSON.parse(extractCodeBlockContent(response.text));
  },
});

const contentDevelopmentStep = new Step({
  id: "Content-Development-Step",
  inputSchema: z.object({
    chapters: z.array(
      z.object({
        number: z.number().describe("Chapter number"),
        title: z.string().describe("Chapter title"),
        description: z.string().describe("Chapter description"),
      })
    ),
  }),
  outputSchema: z.string().describe("Content in markdown format"),
  execute: async ({ context }) => {
    consoleLogger.info("🏃🏻‍♀️ Executing Content Writer Step");

    const chapters = context.getStepResult(chapterParserStep).chapters || [];
    const finalContent: {
      number: number;
      title: string;
      content: string;
    }[] = [];

    writeOutputToFile("", "content.md");

    // const chapter = chapters[0];
    for (const chapter of chapters) {
      // Trial count
      let count = 0;
      const maxRetries = MAX_RETRIES;

      // judgement from the judge agent
      let judge: "proceed" | "revise" = "revise";

      let result = "";

      // Content revision loop
      let chapterStructure = context.getStepResult(outlineStep);
      let prompt = createContentWriterPrompt(
        chapterStructure,
        chapter.title,
        chapter.description
      );
      while (count < maxRetries && judge === "revise") {
        const response = await contentWriterAgent.generate(prompt, {
          temperature: 0.5,
        });
        consoleLogger.info(
          `✈️ Content generated (${count + 1}): \n${response.text}`
        );
        // Write the content to a file
        addOutputToFile(
          `\n\n==== Chapter ${chapter.number}: trial ${count + 1} ====\n\n${response.text}`,
          "content.md"
        );
        // Get feedback from the reflection agent
        const userQuery = context.inputData.query;
        const feedbackPrompt = createContentReflectionPrompt(
          chapterStructure,
          chapter.title,
          response.text
        );
        const feedbackResponse =
          await contentReflectionAgent.generate(feedbackPrompt);
        consoleLogger.info(
          `✈️ Content feedback (${count + 1}): \n${feedbackResponse.text}`
        );
        addOutputToFile(
          `\n\n==== Chapter ${chapter.number}: feedback ${count + 1} ====\n\n${feedbackResponse.text}`,
          "content.md"
        );
        // Get judgement from the judge agent
        const judgePrompt = createPhaseJudgePrompt(
          "content",
          response.text,
          feedbackResponse.text
        );
        const judgeResponse = await phaseJudgeAgent.generate(judgePrompt);
        consoleLogger.info(
          `✈️ Content judgement (${count + 1}): \n${judgeResponse.text}`
        );
        try {
          const judgeResult = JSON.parse(
            extractCodeBlockContent(judgeResponse.text)
          );
          judge = judgeResult.action;
          if (judge === "revise") {
            const reason = judgeResult.reason;
            consoleLogger.info(
              `✈️ Content revision reason (${count + 1}): \n${reason}`
            );
            addOutputToFile(
              `\n\n==== Chapter ${chapter.number}:  revision reason ${count + 1} ====\n\n${reason}`,
              "content.md"
            );
            const userQuery = context.inputData.query;
            const newPrompt = createFeedbackPrompt(
              userQuery,
              response.text,
              feedbackResponse.text
            );
            prompt = newPrompt;
          }
          result = response.text;
        } catch (error) {
          consoleLogger.error(
            `Error parsing judgement response: ${judgeResponse.text}`
          );

          // Fallback to default behaviour
          judge = "proceed";
          result = response.text;
        }
        count++;
      }
      if (judge === "revise") {
        consoleLogger.error("Content revision failed after maximum retries.");
      }
      // Write the final content to a file
      addOutputToFile(`\n\n==== final content ====\n\n${result}`, "content.md");
      finalContent.push({
        ...chapter,
        content: result,
      });
    }
    // Combine all results
    // sort by chapter number
    finalContent.sort((a, b) => a.number - b.number);
    const combinedContent: string = finalContent
      .map((chapter) => chapter.content)
      .join("\n\n");

    writeOutputToFile(
      `\n\n==== final content ====\n\n${combinedContent}`,
      "final_content_draft.md"
    );
    return combinedContent;
  },
});

// Step 5: Final Report
const finalReportStep = new Step({
  id: "Final-Report-Step",
  inputSchema: z.object({
    content: z.string().describe("Final content in markdown format"),
  }),
  outputSchema: z.string().describe("Final report in markdown format"),
  execute: async ({ context }) => {
    consoleLogger.info("🏃🏻‍♀️ Executing Final Report Writer Step");
    const content = context.getStepResult(contentDevelopmentStep);
    let prompt = createFinalReportWriterPrompt(content);
    writeOutputToFile("", "final_report.md");
    let result = "";
    let count = 0;
    const maxRetries = MAX_RETRIES;
    let judge: "proceed" | "revise" = "revise";

    while (count < maxRetries && judge === "revise") {
      const response = await finalReportWriterAgent.generate(prompt);
      consoleLogger.info(`✈️ Final report generated: \n${response.text}`);
      // Write the final report to a file
      addOutputToFile(
        `\n\n==== Trial ${count + 1} final report ====\n\n${response.text}`,
        "final_report.md"
      );
      // Get feedback from the reflection agent
      const feedbackPrompt = createFinalReportReflectionPrompt(response.text);
      const feedbackResponse =
        await finalReportReflectionAgent.generate(feedbackPrompt);
      consoleLogger.info(
        `✈️ Final report feedback: \n${feedbackResponse.text}`
      );
      addOutputToFile(
        `\n\n==== Trial ${count + 1} final report feedback ====\n\n${feedbackResponse.text}`,
        "final_report.md"
      );
      // Get judgement from the judge agent
      const judgePrompt = createPhaseJudgePrompt(
        "final-report",
        response.text,
        feedbackResponse.text
      );
      const judgeResponse = await phaseJudgeAgent.generate(judgePrompt);
      consoleLogger.info(`✈️ Final report judgement: \n${judgeResponse.text}`);
      try {
        const judgeResult = JSON.parse(
          extractCodeBlockContent(judgeResponse.text)
        );
        judge = judgeResult.action;
        if (judge === "proceed") {
          result = response.text;
        }
        if (judge === "revise") {
          const reason = judgeResult.reason;
          consoleLogger.info(`✈️ Final report revision reason: \n${reason}`);
          addOutputToFile(
            `\n\n==== Trial ${count + 1} final report revision reason ====\n\n${reason}`,
            "final_report.md"
          );
          const userQuery = context.inputData.query;
          const newPrompt = createFeedbackPrompt(
            userQuery,
            response.text,
            feedbackResponse.text
          );
          prompt = newPrompt;
        }
        result = response.text;
      } catch (error) {
        consoleLogger.error(
          `Error parsing judgement response: ${judgeResponse.text}`
        );

        // Fallback to default behaviour
        judge = "proceed";
        result = response.text;
      }
      count++;
    }
    if (judge === "revise") {
      consoleLogger.error(
        "Final report revision failed after maximum retries."
      );
    }
    // Write the final report to a file
    writeOutputToFile(result, "completed_report.md");
    return result;
  },
});

// Workflow
export const cheapResearchWorkflow = new Workflow({
  name: "Cheap-Research-Workflow",
  triggerSchema: z.object({
    query: z.string().describe("調査のリクエスト（調査の目的、調査の範囲、特に調査してほしいことなど）を入力してください。"),
  }),  
});

cheapResearchWorkflow
  .step(outlineStep)
  .then(chapterParserStep)
  .then(contentDevelopmentStep)
  .then(finalReportStep)
  .commit();

function isStepSuccess(obj: any): obj is { status: "success"; output: unknown } {
  return obj && obj.status === "success" && "output" in obj;
}

// create a workflow as a tool
const reportInputSchema = z.object({
  reportRequest: z.string().describe("調査のリクエスト（調査の目的、調査の範囲、特に調査してほしいことなど）を入力してください。"),
});
const reportOutputSchema = z
  .object({
    finalReport: z.string().describe("Final report in markdown format"),
  })
  .describe("Final report in markdown format");

export const cheapResearchTool = createTool({
  id: "Exec-Research",
  description:
    "詳細な調査を依頼するときに使用します。調査のリクエスト（調査の目的、調査の範囲、特に調査してほしいことなど）を入力してください。",
  inputSchema: reportInputSchema,
  outputSchema: reportOutputSchema,
  execute: async ({ context }) => {
    const { reportRequest } = context;
    console.log(`🏃🏻‍♀️ Executing Cheap Research: ${JSON.stringify(context, null, 2)}`);
    console.log(`Report request: ${reportRequest}`);
    // const { runId, start } = await cheapResearchWorkflow.createRun(); // Original
    const { start } = await cheapResearchWorkflow.createRun(); // Simplified if runId is not needed
    const runResult = await start({
      triggerData: {
        query: reportRequest,
      }
    });
    try {
      console.log('runResult', JSON.stringify(runResult, null, 5));
      const result = runResult.results[finalReportStep.id];
      if (isStepSuccess(result)) {
        consoleLogger.info(
          `Workflow run completed with final report: ${result.output}`
        );
        if (!result.output){
          consoleLogger.error("Final report is empty.");
          return {
            finalReport: "No content generated.",
          };
        }
        return {
          finalReport: result.output as unknown as string,
        }; // Make sure this matches the corrected reportOutputSchema
      }
      // ... handle failure case ...
      // You might need a return statement here for the failure case too
      consoleLogger.error("Step was not successful or result is missing.");
      return {
        finalReport: "Workflow step failed.", // Example failure return
      };
    } catch (error) {
      consoleLogger.error(`Error during workflow execution: ${error}`);
      // Also return the expected shape on error
      return {
        finalReport: "An error occurred during execution.", // Example error return
      };
    }
  },
});
