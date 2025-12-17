import { NextResponse } from 'next/server';
import { getAuthenticatedGuard } from '@/lib/guard-auth';
import Redis from 'ioredis';

export async function GET() {
  const guard = await getAuthenticatedGuard();

  if (!guard) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  // Create a new Redis instance for subscription
  const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    enableReadyCheck: false,
  });

  subscriber.on('error', err => {
    console.error('Redis subscription error (Guard SSE):', err);
  });

  let interval: NodeJS.Timeout;

  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to guard-specific channel
      const channel = `guard:${guard.id}`;
      await subscriber.subscribe(channel);

      subscriber.on('message', (chan, message) => {
        if (chan === channel) {
          try {
            const data = JSON.parse(message);
            
            // Check for session revocation
            if (data.type === 'session_revoked') {
              // If the new token version is higher than what we have in the closure (current session),
              // force a logout.
              if (data.newTokenVersion > guard.tokenVersion) {
                const event = `event: force_logout\ndata: ${JSON.stringify({ reason: 'logged_in_elsewhere' })}\n\n`;
                controller.enqueue(encoder.encode(event));
              }
            }
          } catch {
            console.error('Error parsing Redis message:');
          }
        }
      });

      // Keepalive (every 30s)
      interval = setInterval(() => {
        try {
          const ping = `: ping\n\n`;
          controller.enqueue(encoder.encode(ping));
        } catch {
          clearInterval(interval);
        }
      }, 30000);
    },
    async cancel() {
      if (interval) clearInterval(interval);
      await subscriber.quit();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
