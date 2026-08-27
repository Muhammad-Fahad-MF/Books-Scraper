import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors/http-error.js";
import { APIError } from "openai";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(`[Error] ${err.name}: ${err.message}`);

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      detail: err.details,
    });
  }

  if (err instanceof APIError) {
    return res.status(err.status || 500).json({
      error: "OpenAIAPIError",
      message: err.message,
      code: err.code,
    });
  }

  return res.status(500).json({
    error: "InternalServerError",
    message: "An unexpected internal server error occurred.",
  });
};
