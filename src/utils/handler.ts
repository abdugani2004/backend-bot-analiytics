import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import { AppError, isAppError } from "./errors";
import { logger } from "./logger";
import { errorResponse } from "./response";

type LambdaHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyStructuredResultV2>;

export const createHandler = (handler: LambdaHandler): LambdaHandler => {
  return async (event, context) => {
    const requestId = context.awsRequestId;
    const startedAt = Date.now();

    logger.info("request_started", {
      requestId,
      routeKey: event.routeKey,
      rawPath: event.rawPath,
    });

    try {
      const response = await handler(event, context);

      logger.info("request_completed", {
        requestId,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });

      return response;
    } catch (error) {
      const appError = isAppError(error)
        ? error
        : new AppError("Internal server error", 500, "INTERNAL_ERROR");

      logger.error("request_failed", {
        requestId,
        code: appError.code,
        statusCode: appError.statusCode,
        details: appError.details,
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startedAt,
      });

      return errorResponse(
        appError.message,
        appError.statusCode,
        appError.code,
        appError.details,
      );
    }
  };
};
