import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.js";
import { env } from "../config/env.js";
import {
  enrichOutputSchema,
  type EnrichInput,
} from "../models/enrich-model.js";
import { BadGatewayError } from "../errors/http-error.js";
import { appendFile, existsSync, mkdirSync } from "node:fs";

const LOGSPATH = "./logs";
const MODELLOGS = "llm_logs.jsonl";

interface LLMLog {
  id: string;
  prompt_version: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  // input_tokens + output_tokens != total_tokens, because there are thinking tokens included
  total_tokens: number;
  duration: number;
  attempts: number;
}

const exponentialBackoff = (attempt: number) => {
  return (Math.pow(2, attempt) + Math.floor(Math.random() * 3)) * 1000; // adding random from 0-7
};

export class LLMProvider {
  private client: OpenAI;
  private cachedSystemPrompt: string | null = null;
  private promptPath = "./prompts/enrich-v1.md";

  constructor() {
    this.client = new OpenAI({
      baseURL: env.GEMINI_BASE_URL,
      apiKey: env.GEMINI_API_KEY,
      timeout: 30000,
      maxRetries: 1,
    });
  }

  private async appendLLMLog(log: LLMLog) {
    if (!existsSync(LOGSPATH)) {
      mkdirSync(LOGSPATH);
    }
    const jsonLog = JSON.stringify(log) + " \n";
    appendFile(`${LOGSPATH}/${MODELLOGS}`, jsonLog, "utf-8", (err) => {
      if (err) console.error(err);
    });
  }

  private async getSystemPrompt(): Promise<string> {
    if (!this.cachedSystemPrompt) {
      this.cachedSystemPrompt = await readFile(this.promptPath, {
        encoding: "utf-8",
      });
    }
    return this.cachedSystemPrompt;
  }

  public async fetchRequest(
    record: EnrichInput,
    attempt: number,
    errorMessage?: string,
  ) {
    const systemPrompt = await this.getSystemPrompt();
    const beforeRequestTime = new Date();
    const response = await this.client.chat.completions.create({
      model: env.GEMINI_MODEL,
      messages: [
        {
          role: "system",
          content: errorMessage
            ? `${systemPrompt}\n\n${errorMessage}`
            : systemPrompt,
        },
        { role: "user", content: JSON.stringify(record) },
      ],
      temperature: 0.2,
      response_format: zodResponseFormat(enrichOutputSchema, "book_record"),
    });
    const afterRequestTime = new Date();
    const rawContent = response.choices[0]?.message.content;
    if (!rawContent) {
      throw new BadGatewayError("LLM Provider returned an empty response.");
    }

    const parsedJson = JSON.parse(rawContent);

    this.appendLLMLog({
      id: response.id,
      prompt_version: this.promptPath.split("/").pop() ?? "v1",
      model: response.model,
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
      duration: afterRequestTime.getTime() - beforeRequestTime.getTime(),
      attempts: attempt,
    });

    return parsedJson;
  }

  public async getResponse(
    record: EnrichInput,
    errorMessage?: string,
    attempt: number = 0,
  ): Promise<any> {
    try {
      const response = await this.fetchRequest(
        record,
        attempt + 1,
        errorMessage,
      );
      return response;
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        console.log(err.message);
        const retryErrors = [429, 500, 503, 504];

        if (!retryErrors.includes(err.status)) throw err;
        if (err.code === "quota_exceeded") throw err; // one of 429 error

        const retryAfter = err.headers?.get("retry-after");
        if (retryAfter) {
          const randomDelay = Math.floor(Math.random() * 4);
          setTimeout(
            () => console.log(`retrying in ${retryAfter + randomDelay}`),
            (retryAfter + randomDelay) * 1000,
          );
          return await this.getResponse(record, errorMessage);
        }

        const delay = exponentialBackoff(attempt);
        setTimeout(() => {
          console.log(`retrying in ${delay}`);
        }, delay);
        return await this.getResponse(record, errorMessage, ++attempt);
      } else {
        throw err;
      }
    }
  }
}

export const llmProvider = new LLMProvider();
