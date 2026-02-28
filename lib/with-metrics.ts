import { httpRequestDuration, httpRequestsTotal } from "@/lib/metrics";

type RouteHandler = (
  req: Request,
  context?: unknown,
) => Response | Promise<Response>;

function extractRoute(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname;
  } catch {
    return "unknown";
  }
}

export function withMetrics(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    const route = extractRoute(req.url);
    const method = req.method;
    const end = httpRequestDuration.startTimer({ method, route });

    let status = 500;
    try {
      const response = await handler(req, context);
      status = response.status;
      return response;
    } catch (error) {
      status = 500;
      throw error;
    } finally {
      end({ status_code: String(status) });
      httpRequestsTotal.inc({
        method,
        route,
        status_code: String(status),
      });
    }
  };
}
