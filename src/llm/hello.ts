import "dotenv/config";
import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { enrichOutputSchema, type EnrichInput } from "../models/enrich-model.js";
import { zodResponseFormat } from "openai/helpers/zod.js";

const baseURL = process.env.OPENROUTER_BASE_URL;
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL;

const client = new OpenAI({
  baseURL: baseURL,
  apiKey: apiKey
});

const promptPath = "./prompts/enrich-v1.md";

export const getMessage = async (record: EnrichInput) => {
  try {
    console.log(baseURL, apiKey, model);
    const systemPrompt = await readFile(promptPath, { encoding: "utf-8"}); 
    const res = await client.chat.completions.create({
      model: model as string,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(record) }
      ],
      temperature: 0.2,
      response_format: zodResponseFormat(enrichOutputSchema, "book_record")
    });
    console.log(res.choices[0]?.message.content);
    console.log(res);
    return res.choices[0]?.message.content;
  } catch (err) {
    console.error(err);
    throw err;
  }
};
