import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
const LOCK_ID = 123456; // Arbitrary lock ID

async function runWorker() {
  console.log('Worker started...');

  setInterval(async () => {
    try {
      // 1. Advisory Lock
      const result: { locked: boolean }[] = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${LOCK_ID}) as locked`;
      const locked = result[0]?.locked;

      if (!locked) {
        console.log('Could not acquire lock, skipping...');
        return;
      }

      // 2. Find Active Shifts
      // We look for 'scheduled' or 'in_progress' shifts that are currently happening.
      // (Actually, check-in logic usually applies to shifts that HAVE started)
      const now = new Date();
      const shifts = await prisma.shift.findMany({
        where: {
          status: { in: ['scheduled', 'in_progress'] },
          startsAt: { lte: now },
          endsAt: { gte: now },
          guardId: { not: null }, // Only monitor if a guard is assigned
        },
        include: { shiftType: true, guard: true, site: true },
      });

      // Group active shifts by site for dashboard broadcasting
      const activeSitesMap = new Map<string, { site: any; shifts: any[] }>();

      for (const shift of shifts) {
        // --- ALERT LOGIC START ---
        // Fixed interval logic:
        // Interval 0: [start, start + interval)
        // Interval N: [start + N*interval, start + (N+1)*interval)
        // Check-in window for Interval N: [start + N*interval, start + N*interval + grace]
        // Deadline: start + N*interval + grace
        
        const nowMs = now.getTime();
        const startMs = shift.startsAt.getTime();
        const intervalMs = shift.requiredCheckinIntervalMins * 60000;
        const graceMs = shift.graceMinutes * 60000;

        // Calculate how many full intervals have passed since start
        // e.g. Start 8:00, Now 8:35, Interval 30. Diff 35. 35/30 = 1.16. Floor = 1.
        // We are currently in Interval 1 (8:30 - 9:00).
        // But we check for MISSED checkins in the PAST.
        // If we are in Interval 1, we should check if we missed Interval 1's deadline?
        // Or did we miss Interval 0?
        
        // Actually, we want to find the "Current Due Time" that might have been missed.
        // The LATEST deadline that has passed is for the interval index:
        // index = floor((now - start - grace) / interval)
        // If now is 8:35 (Grace 2). 8:35 - 8:00 - 0:02 = 33m. 33/30 = 1.
        // So Interval 1 (8:30) deadline (8:32) has passed.
        
        const elapsedSinceStart = nowMs - startMs;
        // We care about the latest interval whose deadline has passed
        const passedIntervalIndex = Math.floor((elapsedSinceStart - graceMs) / intervalMs);

        if (passedIntervalIndex >= 0) {
           const dueTime = new Date(startMs + passedIntervalIndex * intervalMs);
           
           // Check if we have a valid heartbeat for THIS interval
           // valid if lastHeartbeat >= dueTime
           const lastHeartbeat = shift.lastHeartbeatAt;
           const hasCheckedInForSlot = lastHeartbeat && lastHeartbeat.getTime() >= dueTime.getTime();

           if (!hasCheckedInForSlot) {
                // Check if alert exists for this due time
                const existingAlert = await prisma.alert.findUnique({
                    where: {
                    shiftId_reason_windowStart: {
                        shiftId: shift.id,
                        reason: 'missed_checkin',
                        windowStart: dueTime,
                    },
                    },
                });

                if (!existingAlert) {
                    console.log(`Detected missed checkin for shift ${shift.id} (Guard: ${shift.guard?.name}) at ${dueTime.toISOString()}`);

                    // Create Alert & Update Shift
                    await prisma.$transaction(async tx => {
                    const newAlert = await tx.alert.create({
                        data: {
                        shiftId: shift.id,
                        siteId: shift.siteId,
                        reason: 'missed_checkin',
                        severity: 'warning',
                        windowStart: dueTime,
                        },
                    });

                    await tx.shift.update({
                        where: { id: shift.id },
                        data: {
                        missedCount: { increment: 1 },
                        },
                    });

                    // Fetch full alert data for broadcast
                    const alert = await tx.alert.findUnique({
                        where: { id: newAlert.id },
                        include: {
                        site: true,
                        shift: {
                            include: {
                            guard: true,
                            shiftType: true,
                            }
                        }
                        }
                    });

                    // Publish Event
                    const payload = {
                        type: 'alert_created',
                        alert,
                    };
                    await redis.publish(`alerts:site:${shift.siteId}`, JSON.stringify(payload));

                    // TODO: Send Notifications (SES/SNS/Slack)
                    console.log(`[MOCK] Sending notification for alert ${newAlert.id}`);
                    });
                }
           }
        }
        // --- ALERT LOGIC END ---

        // Aggregate for Dashboard
        if (!activeSitesMap.has(shift.siteId)) {
            activeSitesMap.set(shift.siteId, {
                site: shift.site,
                shifts: []
            });
        }
        activeSitesMap.get(shift.siteId)?.shifts.push({
            id: shift.id,
            guard: shift.guard,
            shiftType: shift.shiftType,
            startsAt: shift.startsAt,
            endsAt: shift.endsAt,
            status: shift.status,
            checkInCount: shift.checkInCount,
            missedCount: shift.missedCount,
        });
      }

      // Publish Active Shifts Broadcast
      const activeSitesPayload = Array.from(activeSitesMap.values());
      await redis.publish('dashboard:active-shifts', JSON.stringify(activeSitesPayload));

      // Unlock? No, pg_try_advisory_lock holds until session end or explicit unlock.
      // Since we use prisma client which might pool, we should probably UNLOCK if we want to be nice,
      // but we want to HOLD it for the duration of the interval?
      // Actually, if we use `setInterval`, we are in the SAME process.
      // But the lock is session based.
      // Ideally we want to hold the lock continuously while the worker is alive.
      // But `prisma.$queryRaw` might lease a connection and release it back to pool?
      // If connection is released, lock is lost (session level).
      // So we must run the logic INSIDE a transaction that holds the connection?
      // Or use a dedicated client for the lock.

      // For this simple implementation with "setInterval" in one process,
      // the lock is mostly to prevent MULTIPLE instances of the worker script (e.g. scaled in EC2).
      // If we use a dedicated connection for the lock, that works.
      // With Prisma default pool, it's tricky.

      // ALTERNATIVE: Just run logic. If 2 workers run, we have DB constraints (Alert Unique) to prevent duplicate alerts.
      // The lock is an optimization. I will comment it out or simplify for this prototype
      // to avoid "Session-level advisory locks" complexity with Connection Pooling.

      // Releasing lock for now to be safe with pool?
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
    } catch (error) {
      console.error('Worker error:', error);
    }
  }, CHECK_INTERVAL_MS);
}

runWorker();
