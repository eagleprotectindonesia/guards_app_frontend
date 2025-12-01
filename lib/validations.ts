import { z } from 'zod';

export const RoleEnum = z.enum(['admin', 'supervisor', 'guard']);
export const ShiftStatusEnum = z.enum(['assigned', 'unassigned', 'canceled']);

// --- Site ---
export const createSiteSchema = z.object({
  name: z.string().min(1),
  timeZone: z.string().min(1), // Validate IANA time zone if possible, string for now
});

// --- User ---
export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: RoleEnum,
  active: z.boolean().default(true),
});

// --- Post ---
export const createPostSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1),
  requiredHeadcount: z.number().int().min(1).default(1),
});

// --- Shift ---
export const createShiftSchema = z.object({
  postId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime(), // ISO string expected from API
  endsAt: z.string().datetime(),
  requiredCheckinIntervalMins: z.number().int().min(5).default(60),
  graceMinutes: z.number().int().min(1).default(15),
});

// --- Checkin ---
export const checkInSchema = z.object({
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(), // Example metadata
  source: z.string().optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
