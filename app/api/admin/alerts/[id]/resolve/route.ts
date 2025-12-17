import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { getAdminIdFromToken } from '@/lib/admin-auth';
import { ShiftStatus } from '@prisma/client';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const adminId = await getAdminIdFromToken();

  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized: No admin found' }, { status: 401 });
  }

  let outcome = 'resolve';
  let note = '';

  try {
    // Attempt to parse body if present
    const json = await req.json();
    if (json.outcome) outcome = json.outcome;
    if (json.note) note = json.note;
  } catch {
    // No body or invalid JSON, default to 'resolve'
  }

  try {
    const alert = await prisma.alert.findUnique({
      where: { id },
      include: { shift: true },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    if (outcome === 'forgive') {
      // FORGIVE: Soft Delete (Mark as forgiven)
      const updatedAlert = await prisma.$transaction(async tx => {
        const a = await tx.alert.update({
          where: { id },
          data: {
            resolvedAt: new Date(),
            resolvedById: adminId,
            resolutionType: 'forgiven',
            resolutionNote: note,
          },
          include: {
            site: true,
            resolverAdmin: true,
            ackAdmin: true,
            shift: {
              include: {
                guard: true,
                shiftType: true,
              },
            },
          },
        });

        if (alert.reason === 'missed_checkin') {
          const updateData: { missedCount?: { decrement: number }; status?: ShiftStatus } = {};

          // For missed checkin, we decrement the missed count as it was incremented on alert creation
          if (alert.shift.missedCount > 0) {
            updateData.missedCount = { decrement: 1 };
          }

          // Check if this was the last checkin
          const intervalMs = alert.shift.requiredCheckinIntervalMins * 60000;
          const nextSlotStartMs = new Date(alert.windowStart).getTime() + intervalMs;

          if (nextSlotStartMs >= new Date(alert.shift.endsAt).getTime()) {
            updateData.status = 'completed';
          }

          if (Object.keys(updateData).length > 0) {
            await tx.shift.update({
              where: { id: alert.shiftId },
              data: updateData,
            });
          }
        } else if (alert.reason === 'missed_attendance') {
          // For missed attendance, we record the attendance as 'late'
          // Check if attendance already exists
          const existingAttendance = await tx.attendance.findUnique({
            where: { shiftId: alert.shiftId },
          });

          if (!existingAttendance) {
            const newAttendance = await tx.attendance.create({
              data: {
                shiftId: alert.shiftId,
                guardId: alert.shift.guardId,
                recordedAt: new Date(),
                status: 'late',
                metadata: { note: 'Auto-created via alert forgiveness' },
              },
            });

            // Update shift to connect attendance and set status to in_progress if needed
            await tx.shift.update({
              where: { id: alert.shiftId },
              data: {
                attendance: { connect: { id: newAttendance.id } },
                status: alert.shift.status === 'scheduled' ? 'in_progress' : undefined,
              },
            });
          }
        }

        return a;
      });

      // Publish update (Frontend will handle moving it to history/removing from active)
      const payload = {
        type: 'alert_updated',
        alert: updatedAlert,
      };
      await redis.publish(`alerts:site:${alert.siteId}`, JSON.stringify(payload));

      return NextResponse.json({ success: true, outcome: 'forgive', alert: updatedAlert });
    } else {
      // RESOLVE: Mark as resolved (standard)
      const updatedAlert = await prisma.$transaction(async tx => {
        const a = await tx.alert.update({
          where: { id },
          data: {
            resolvedAt: new Date(),
            resolvedById: adminId,
            resolutionType: 'standard',
            resolutionNote: note,
          },
          include: {
            site: true,
            resolverAdmin: true,
            ackAdmin: true,
            shift: {
              include: {
                guard: true,
                shiftType: true,
              },
            },
          },
        });

        if (alert.reason === 'missed_attendance') {
          // If missed attendance is resolved without forgiveness, it means they are absent.
          const existingAttendance = await tx.attendance.findUnique({
            where: { shiftId: alert.shiftId },
          });

          if (!existingAttendance) {
            await tx.attendance.create({
              data: {
                shiftId: alert.shiftId,
                guardId: alert.shift.guardId,
                recordedAt: new Date(),
                status: 'absent',
                metadata: { note: 'Auto-created via alert resolution (absent)' },
              },
            });

            // Also mark shift as missed to stop check-in alerts
            await tx.shift.update({
              where: { id: alert.shiftId },
              data: {
                status: 'missed',
              },
            });
          }
        }
        return a;
      });

      // Publish update
      const payload = {
        type: 'alert_updated',
        alert: updatedAlert,
      };
      await redis.publish(`alerts:site:${updatedAlert.siteId}`, JSON.stringify(payload));

      return NextResponse.json(updatedAlert);
    }
  } catch (error) {
    console.error('Error resolving alert:', error);
    return NextResponse.json({ error: 'Error resolving alert' }, { status: 500 });
  }
}
