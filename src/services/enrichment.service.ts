import { appendFile, existsSync, mkdirSync } from "node:fs";
import { env } from "../config/env.js";
import { ValidationError } from "../errors/http-error.js";
import { enrichOutputSchema, type EnrichInput, type EnrichOutput } from "../models/enrich-model.js";
import { llmProvider } from "../providers/llm.provider.js";
import { prettifyError } from "zod/v4/core";

const LOGSPATH = "./logs";
const LOGSFILE = "quarantine.jsonl";

function appendToQuarantineLogs(json: string) {
  if(!existsSync(LOGSPATH)){
    mkdirSync(LOGSPATH, { recursive: true});
  }
  appendFile( `${LOGSPATH}/${LOGSFILE}`, `${json} \n`, 'utf-8', (err) => {
    if (err) console.error(err);
  })
}

export class EnrichmentService {
  public async enrichRecord(record: EnrichInput): Promise<EnrichOutput> {
    if (env.ENABLE_LLM_STUB) {
      return this.getMockEnrichment(record);
    }
    const res = await llmProvider.getResponse(record);
    const parsed = enrichOutputSchema.safeParse(res);
    if(parsed.success){
      return parsed.data;
    }
    const errorMessage = `Your previous output contained this error: ${prettifyError(parsed.error)}`;
    console.log(errorMessage);
    const retryResponse = await llmProvider.getResponse(record, errorMessage);
    const retryParsed = enrichOutputSchema.safeParse(retryResponse);
    if(retryParsed.success){
      return retryParsed.data;
    }
    appendToQuarantineLogs(JSON.stringify(retryParsed));
    throw new ValidationError("Failed to enrich record after retry.");
  }

  private getMockEnrichment(record: EnrichInput): EnrichOutput {
    return {
      cleansed_description: {
        value: record.description ?? "",
        quality: "clean",
        confidence: 1.0,
        reason: "Mock response generated for testing.",
      },
      summary: "This is a mock summary generated in stub mode.",
      category: {
        value: "technology",
        confidence: 1.0,
        reason: "Mock category assignment.",
      },
      target_audience: {
        value: "adults",
        confidence: 1.0,
        reason: "Mock target audience assignment.",
      },
    };
  }
}

export const enrichmentService = new EnrichmentService();
