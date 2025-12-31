import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function getShiftById(id: string) {
  return prisma.shift.findUnique({
    where: { id, deletedAt: null },
    include: {
      site: true,
      shiftType: true,
      guard: true,
    },
  });
}

export async function getPaginatedShifts(params: {
  where: Prisma.ShiftWhereInput;
  orderBy: Prisma.ShiftOrderByWithRelationInput;
  skip: number;
  take: number;
  include?: Prisma.ShiftInclude;
}) {
  const { where, orderBy, skip, take, include } = params;
  const finalWhere = { ...where, deletedAt: null };

  const [shifts, totalCount] = await prisma.$transaction(
    async tx => {
      return Promise.all([
        tx.shift.findMany({
          where: finalWhere,
          orderBy,
          skip,
          take,
          include: include || {
            site: { select: { name: true } },
            shiftType: { select: { name: true, startTime: true, endTime: true } },
            guard: { select: { name: true } },
          },
        }),
        tx.shift.count({ where: finalWhere }),
      ]);
    },
    { timeout: 5000 }
  );

  return { shifts, totalCount };
}

export async function checkOverlappingShift(guardId: string, startsAt: Date, endsAt: Date, excludeShiftId?: string) {
  return prisma.shift.findFirst({
    where: {
      guardId,
      deletedAt: null,
      id: excludeShiftId ? { not: excludeShiftId } : undefined,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
}

export async function createShiftWithChangelog(data: Prisma.ShiftCreateInput, adminId: string) {
  return prisma.$transaction(
    async tx => {
      const createdShift = await tx.shift.create({
        data: {
          ...data,
          createdBy: adminId,
        },
        include: {
          site: true,
          shiftType: true,
          guard: true,
        },
      });

      await tx.changelog.create({
        data: {
          action: 'CREATE',
          entityType: 'Shift',
          entityId: createdShift.id,
          adminId: adminId,
          details: {
            site: createdShift.site.name,
            type: createdShift.shiftType.name,
            guard: createdShift.guard?.name || 'Unassigned',
            date: createdShift.date,
            startsAt: createdShift.startsAt,
            endsAt: createdShift.endsAt,
          },
        },
      });

      return createdShift;
    },
    { timeout: 10000 }
  );
}

export async function updateShiftWithChangelog(id: string, data: Prisma.ShiftUpdateInput, adminId: string) {
  return prisma.$transaction(
    async tx => {
      const updatedShift = await tx.shift.update({
        where: { id, deletedAt: null },
        data,
        include: {
          site: true,
          shiftType: true,
          guard: true,
        },
      });

      await tx.changelog.create({
        data: {
          action: 'UPDATE',
          entityType: 'Shift',
          entityId: updatedShift.id,
          adminId: adminId,
          details: {
            site: updatedShift.site.name,
            type: updatedShift.shiftType.name,
            guard: updatedShift.guard?.name || 'Unassigned',
            date: updatedShift.date,
            startsAt: updatedShift.startsAt,
            endsAt: updatedShift.endsAt,
            interval: updatedShift.requiredCheckinIntervalMins,
            grace: updatedShift.graceMinutes,
            status: updatedShift.status,
          },
        },
      });

      return updatedShift;
    },
    { timeout: 10000 }
  );
}

export async function deleteShiftWithChangelog(id: string, adminId: string) {
  return prisma.$transaction(
    async tx => {
      const shiftToDelete = await tx.shift.findUnique({
        where: { id, deletedAt: null },
        include: { site: true, shiftType: true, guard: true },
      });

      if (!shiftToDelete) return;

      await tx.shift.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      await tx.changelog.create({
        data: {
          action: 'DELETE',
          entityType: 'Shift',
          entityId: id,
          adminId: adminId,
          details: {
            site: shiftToDelete.site.name,
            type: shiftToDelete.shiftType.name,
            guard: shiftToDelete.guard?.name || 'Unassigned',
            date: shiftToDelete.date,
            deletedAt: new Date(),
          },
        },
      });
    },
    { timeout: 10000 }
  );
}

export async function bulkCreateShiftsWithChangelog(shiftsToCreate: Prisma.ShiftCreateManyInput[], adminId: string) {
  return prisma.$transaction(
    async tx => {
      const createdShifts = await tx.shift.createManyAndReturn({
        data: shiftsToCreate,
        include: {
          site: { select: { name: true } },
          shiftType: { select: { name: true } },
          guard: { select: { name: true } },
        },
      });

      await tx.changelog.createMany({
        data: createdShifts.map(s => ({
          action: 'CREATE',
          entityType: 'Shift',
          entityId: s.id,
          adminId: adminId,
          details: {
            method: 'BULK_UPLOAD',
            site: s.site.name,
            type: s.shiftType.name,
            guard: s.guard?.name || 'Unassigned',
            date: s.date,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          },
        })),
      });

      return createdShifts;
    },
    { timeout: 30000 }
  );
}
