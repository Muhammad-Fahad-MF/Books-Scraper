import * as z from "zod";

export const enrichInputSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().max(5000).nullable(),
});


export const enrichOutputSchema = z.object({
  cleansed_description: z.object({
    value: z.string().max(5000).nullable(),
    quality: z.enum([
      "clean",
      "duplicated_text",
      "truncated_text",
      "missing",
      "html_artifacts",
    ]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(10).max(150),
  }),
  summary: z.string().min(50).max(300),
  category: z.object({
    value: z.enum([
      "fiction",
      "speculative",
      "suspense",
      "memoir",
      "business",
      "technology",
      "science",
      "wellness",
      "humanities",
      "lifestyle",
      "other",
    ]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(10).max(150),
  }),
  target_audience: z.object({
    value: z.enum([
      "children",
      "middle_grade",
      "young_adult",
      "adults",
      "academic",
      "other",
    ]),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(10).max(150),
  }),
});

export type EnrichOutput = z.infer<typeof enrichOutputSchema>;
