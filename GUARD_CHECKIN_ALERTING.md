# Guard Check-in & Alerting System Documentation

## Overview
This document outlines the current implementation of the Guard Check-in, Monitoring, and Alerting system in the `ep-guard-scheduling` project. It describes the lifecycle of a shift, how check-ins are validated using strict time slots, how missed check-ins are detected, and how alerts are managed (including forgiveness and audit trails).

## 1. Data Model Core Concepts

### Shift (`Shift`)
Defines the schedule for a guard at a specific site.
- **Key Fields:**
  - `startsAt`, `endsAt`: Shift duration.
  - `requiredCheckinIntervalMins`: Time in minutes between required check-ins (e.g., 20 mins).
  - `graceMinutes`: Additional time allowed after the interval before a check-in is considered missed.
  - `lastHeartbeatAt`: Timestamp of the last successful check-in.
  - `missedCount`: Counter for missed check-ins (decremented if forgiven).
  - `status`: `scheduled` | `in_progress` | `completed` | `missed`.

### Checkin (`Checkin`)
A record of a guard confirming their presence.
- **Key Fields:**
  - `status`: `on_time` | `late` | `invalid`.
  - `at`: Timestamp.
  - `metadata`: Geolocation or other context.

### Alert (`Alert`)
Generated when a system event requires admin attention.
- **Key Fields:**
  - `reason`: Currently only `missed_checkin`.
  - `windowStart`: The time the check-in was due.
  - `severity`: `warning` | `critical`.
  - `acknowledgedAt` / `resolvedAt`: Lifecycle timestamps.
  - `resolutionType`: `standard` | `forgiven` | `auto`.
  - `resolutionNote`: Mandatory note explaining the resolution/forgiveness.
  - `resolvedById`: Admin ID who resolved/forgave.

## 2. Workflow Description

### A. Monitoring & Detection (`worker.ts`)
A background worker runs continuously (every 60 seconds) to monitor active shifts.

1.  **Scope**: Selects active shifts (`scheduled` or `in_progress`).
2.  **Logic**: Uses fixed intervals based on `shift.startsAt`.
    -   Calculates the **last full interval** that has passed.
    -   Determines the `dueTime` for that interval.
    -   Checks if `shift.lastHeartbeatAt` covers that interval (i.e., `lastHeartbeatAt >= dueTime`).
3.  **Missed Check-in**:
    -   If no valid check-in exists for the passed interval:
        -   Checks if an alert already exists.
        -   If **NO Alert**: Creates `Alert`, increments `shift.missedCount`, publishes `alert_created`.

### B. Guard Check-in (`app/api/shifts/[id]/checkin/route.ts`)
Guards perform check-ins via the mobile interface.

1.  **Strict Time Slots**:
    -   Intervals are calculated strictly from `shift.startsAt`.
    -   **Current Slot Index** = `floor((now - startsAt) / interval)`.
    -   **Target Time** = `startsAt + Index * interval`.
    -   **Deadline** = `Target Time + graceMinutes`.
2.  **Validation**:
    -   **Window Enforcement**: `now` must be `<=` `Deadline`. If `now > Deadline`, returns **400 Too late**.
    -   **Duplication Check**: If `shift.lastHeartbeatAt >= Target Time`, returns **400 Already checked in**.
3.  **Execution**:
    -   Creates `Checkin` (`status: 'on_time'`).
    -   Updates `Shift` (`lastHeartbeatAt`, `checkInStatus`, resets `missedCount` to 0).
    -   **Auto-Resolution**: Automatically resolves any open `missed_checkin` alert for this shift (sets `resolvedAt`, `resolutionType: 'auto'`).

### C. Admin Real-time Dashboard (`app/api/admin/alerts/**`)
Admins monitor and manage alerts via SSE.

1.  **Stream**: Listens for `alert_created` and `alert_updated`.
2.  **Actions**:
    -   **Acknowledge**: Marks alert as seen.
    -   **Resolve**: Marks alert as resolved (`resolutionType: 'standard'`). Requires a mandatory **Note**.
    -   **Forgive**: **Soft Delete**.
        -   Marks alert as resolved (`resolutionType: 'forgiven'`).
        -   Requires a mandatory **Note**.
        -   **Decrements** `shift.missedCount` (restoring guard's performance record).
        -   Publishes `alert_updated` (frontend updates status to Resolved).

## 3. Current Limitations & Action Items

### Authentication
-   Some API endpoints have `TODO` comments regarding Admin authentication checks.

## 4. API Reference

### `POST /api/shifts/[id]/checkin`
-   **Headers**: `Cookie: guard_token=...`
-   **Body**: `{ "location": { "lat": number, "lng": number }, "source": "web" }`
-   **Response**: `{ "checkin": object, "next_due_at": ISOString, "status": "on_time" }` or `400 Error`.

### `POST /api/admin/alerts/[id]/resolve`
-   **Body**: `{ "outcome": "resolve" | "forgive", "note": "string" }`.
-   **Response**: Updated Alert object OR `{ success: true, outcome: "forgive", alert: object }`.
