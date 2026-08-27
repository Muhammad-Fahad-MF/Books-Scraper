import { Router } from "express";
import { enrichmentController } from "../controllers/enrichment.controller.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { enrichInputSchema } from "../models/enrich-model.js";

const router = Router();

router.post(
  "/enrich-record",
  validateBody(enrichInputSchema),
  enrichmentController.enrich
);

export default router;
