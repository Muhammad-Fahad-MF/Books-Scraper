import express, { type Express } from "express";
import morgan from "morgan";
import enrichmentRouter from "./routes/enrichment.router.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app: Express = express();

app.disable("x-powered-by");
app.set("etag", false);

app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.send({ message: "Book Enricher API is running" });
});

// Root endpoint for backward compatibility & sub-route mounting
app.use("/", enrichmentRouter);
app.use("/api/v1", enrichmentRouter);

// Centralized Exception Handler
app.use(errorMiddleware);

export default app;
