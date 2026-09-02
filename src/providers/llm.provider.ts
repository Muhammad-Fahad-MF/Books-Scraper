import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.js";
import { env } from "../config/env.js";
import {
  enrichOutputSchema,
  type EnrichInput,
} from "../models/enrich-model.js";
import { BadGatewayError } from "../errors/http-error.js";

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

  private async getSystemPrompt(): Promise<string> {
    if (!this.cachedSystemPrompt) {
      this.cachedSystemPrompt = await readFile(this.promptPath, {
        encoding: "utf-8",
      });
    }
    return this.cachedSystemPrompt;
  }

  public async fetchRequest(record: EnrichInput, errorMessage?: string) {
    const systemPrompt = await this.getSystemPrompt();
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

    const rawContent = response.choices[0]?.message.content;
    if (!rawContent) {
      throw new BadGatewayError("LLM Provider returned an empty response.");
    }

    const parsedJson = JSON.parse(rawContent);
    console.log(parsedJson);
    return parsedJson;
  }

  public async getResponse(record: EnrichInput, errorMessage?: string) {
    try {
      const response = await this.fetchRequest(record, errorMessage);
      return response;
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        const retryErrors = [ 429, 500, 503, 504 ];

        if(!retryErrors.includes(err.status)) throw err; 
        if (err.code === "quota_exceeded") throw err; // one of 429 error

        if (err.code === "rate_limit_exceeded") {
          const retryAfter = err.headers?.get("retry-after");
          const randomDelay = Math.floor(Math.random() * 7);
          setTimeout(
            () => console.log(`retrying in ${retryAfter + randomDelay}`),
            retryAfter + randomDelay,
          );
          return await this.fetchRequest(record, errorMessage);
        }

      } else {
        throw err;
      }
    }
  }
}

export const llmProvider = new LLMProvider();
