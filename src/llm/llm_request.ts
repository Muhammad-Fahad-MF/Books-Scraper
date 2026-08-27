import { llmProvider } from "../providers/llm.provider.js";
import type { EnrichInput, EnrichOutput } from "../models/enrich-model.js";

export const getRecord = async (record: EnrichInput): Promise<EnrichOutput> => {
  return await llmProvider.fetchEnrichment(record);
};
