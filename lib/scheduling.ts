export type CheckInWindowStatus = 'open' | 'early' | 'late' | 'completed';

export interface CheckInWindowResult {
  status: CheckInWindowStatus;
  currentSlotStart: Date;
  currentSlotEnd: Date;
  nextSlotStart: Date;
  remainingTimeMs: number; // Time until open (if early/completed/late) or close (if open)
}

/**
 * Calculates the current check-in window status for a shift.
 * Unified logic used by API, Worker, and Frontend.
 *
 * Concepts:
 * - Slots start at: ShiftStart + (N * Interval)
 * - Window is: [SlotStart, SlotStart + Grace]
 */
export function calculateCheckInWindow(
  shiftStart: Date,
  intervalMins: number,
  graceMins: number,
  now: Date,
  lastHeartbeat?: Date | null
): CheckInWindowResult {
  const startMs = shiftStart.getTime();
  const intervalMs = intervalMins * 60000;
  const graceMs = graceMins * 60000;
  const nowMs = now.getTime();

  if (nowMs < startMs) {
    // Before shift starts
    return {
      status: 'early',
      currentSlotStart: shiftStart,
      currentSlotEnd: new Date(startMs + graceMs),
      nextSlotStart: shiftStart,
      remainingTimeMs: startMs - nowMs,
    };
  }

  // Calculate current slot index
  const slotIndex = Math.floor((nowMs - startMs) / intervalMs);

  // Calculate times for this slot
  const currentSlotStartMs = startMs + slotIndex * intervalMs;
  const currentSlotEndMs = currentSlotStartMs + graceMs;
  const nextSlotStartMs = currentSlotStartMs + intervalMs;

  // Check if this specific slot is already completed
  const isCompleted = lastHeartbeat && lastHeartbeat.getTime() >= currentSlotStartMs;

  if (isCompleted) {
    return {
      status: 'completed',
      currentSlotStart: new Date(currentSlotStartMs),
      currentSlotEnd: new Date(currentSlotEndMs),
      nextSlotStart: new Date(nextSlotStartMs),
      remainingTimeMs: nextSlotStartMs - nowMs,
    };
  }

  // If not completed, check if we are within the grace window
  if (nowMs <= currentSlotEndMs) {
    return {
      status: 'open',
      currentSlotStart: new Date(currentSlotStartMs),
      currentSlotEnd: new Date(currentSlotEndMs),
      nextSlotStart: new Date(nextSlotStartMs),
      remainingTimeMs: currentSlotEndMs - nowMs,
    };
  } else {
    // We missed the current window
    // Effectively waiting for the NEXT slot
    return {
      status: 'late',
      currentSlotStart: new Date(currentSlotStartMs),
      currentSlotEnd: new Date(currentSlotEndMs),
      nextSlotStart: new Date(nextSlotStartMs),
      remainingTimeMs: nextSlotStartMs - nowMs,
    };
  }
}
