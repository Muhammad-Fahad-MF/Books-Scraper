import { env } from "../config/env.js";
import type { EnrichInput, EnrichOutput } from "../models/enrich-model.js";
import { llmProvider } from "../providers/llm.provider.js";

export class EnrichmentService {
  public async enrichRecord(record: EnrichInput): Promise<EnrichOutput> {
    if (env.ENABLE_LLM_STUB) {
      return this.getMockEnrichment(record);
    }
    return await llmProvider.fetchEnrichment(record);
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
