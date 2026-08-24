import "dotenv/config";
import OpenAI from "openai";

const baseURL = process.env.LLAMA_BASE_URL;
const apiKey = process.env.LLAMA_API_KEY;

console.log(baseURL, apiKey);
const client = new OpenAI({
  baseURL: baseURL,
  apiKey: apiKey
});

const getMessage = async () => {
  try {
    const res = await client.chat.completions.create({
      model: process.env.LLAMA_MODEL as string,
      messages: [
        { role: "user", content: "Hello!" },
      ],
    });
    console.log(res.choices[0]?.message.content);
  } catch (err) {
    console.error(err);
    throw err;
  }
};

await getMessage();
