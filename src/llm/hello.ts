import "dotenv/config";
import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import type { EnrichInput } from "../models/enrich-model.js";

const baseURL = process.env.LLAMA_BASE_URL;
const apiKey = process.env.LLAMA_API_KEY;

const client = new OpenAI({
  baseURL: baseURL,
  apiKey: apiKey
});

const promptPath = "./prompts/enrich-v1.md";

export const getMessage = async (record: EnrichInput) => {
  try {
    const systemPrompt = await readFile(promptPath, { encoding: "utf-8"}); 
    const res = await client.chat.completions.create({
      model: process.env.LLAMA_MODEL as string,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(record) }
      ],
      temperature: 0.2
    });
    console.log(res.choices[0]?.message.content);
    return res.choices[0]?.message.content;
  } catch (err) {
    console.error(err);
    throw err;
  }
};
