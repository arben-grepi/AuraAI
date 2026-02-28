import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { withMetrics } from "@/lib/with-metrics";

const handler = toNextJsHandler(auth);

export const POST = withMetrics(handler.POST);
export const GET = withMetrics(handler.GET);
