export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details: any = null
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class ValidationError extends HttpError {
  constructor(details: any) {
    super(422, "Unprocessable Entity: Validation Failed", details);
    this.name = "ValidationError";
  }
}

export class BadGatewayError extends HttpError {
  constructor(message: string, details?: any) {
    super(502, message, details);
    this.name = "BadGatewayError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = "Resource Not Found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}
