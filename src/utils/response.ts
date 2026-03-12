import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { ApiErrorResponse, ApiSuccessResponse } from "../types/api";

const baseHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Request-Id",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export const successResponse = <T>(
  data: T,
  message = "OK",
  statusCode = 200,
): APIGatewayProxyStructuredResultV2 => {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    message,
  };

  return {
    statusCode,
    headers: baseHeaders,
    body: JSON.stringify(body),
  };
};

export const errorResponse = (
  message: string,
  statusCode = 500,
  code = "INTERNAL_ERROR",
  details: Record<string, unknown> = {},
): APIGatewayProxyStructuredResultV2 => {
  const body: ApiErrorResponse = {
    success: false,
    data: null,
    message,
    error: {
      code,
      details,
    },
  };

  return {
    statusCode,
    headers: baseHeaders,
    body: JSON.stringify(body),
  };
};
