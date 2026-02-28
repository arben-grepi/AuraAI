import { register, collectDefaultMetrics } from 'prom-client';
import '@/lib/metrics'; // Register custom HTTP metrics

collectDefaultMetrics();

export async function GET() {
    const metrics = await register.metrics();
    return new Response(metrics, {
        headers: { 'Content-Type': register.contentType },
    });
}