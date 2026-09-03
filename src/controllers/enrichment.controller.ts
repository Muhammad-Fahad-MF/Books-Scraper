import type { Request, Response, NextFunction } from "express";
import { enrichmentService } from "../services/enrichment.service.js";
import type { EnrichInput } from "../models/enrich-model.js";
import { env } from "../config/env.js";

export class EnrichmentController {
  public enrich = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if(!env.LLM_ENABLED){
        return res.status(503).json({"detail": "Service Unavailable"});
      }
      const record: EnrichInput = req.body;
      const result = await enrichmentService.enrichRecord(record);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const enrichmentController = new EnrichmentController();
