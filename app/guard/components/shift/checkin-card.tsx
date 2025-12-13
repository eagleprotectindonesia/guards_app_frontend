'use client';

import { ShiftWithRelations } from '@/app/admin/(authenticated)/shifts/components/shift-list';
import { useGuardApi } from '@/app/guard/(authenticated)/hooks/use-guard-api';

type CheckInCardProps = {
  activeShift: ShiftWithRelations | null;
  loading: boolean;
  status: string;
  currentTime: Date;
  setStatus: (status: string) => void;
  fetchShift: () => Promise<void>;
};

export default function CheckInCard({
  activeShift,
  loading,
  status,
  currentTime,
  setStatus,
  fetchShift,
}: CheckInCardProps) {
  const { fetchWithAuth } = useGuardApi();

  // Calculate Next Due & Window Status based on Worker Logic (Fixed Intervals)
  let nextDue: Date | null = null;
  let canCheckIn = false;
  let windowMessage = '';

  if (activeShift) {
    const startMs = new Date(activeShift.startsAt).getTime();
    const intervalMs = activeShift.requiredCheckinIntervalMins * 60000;
    const graceMs = activeShift.graceMinutes * 60000;
    const nowMs = currentTime.getTime();

    // The first check-in should be at shift start + first interval, regardless of when attendance is recorded
    const firstCheckInMs = startMs + intervalMs;

    // If current time is before the first check-in time
    if (nowMs < firstCheckInMs) {
      nextDue = new Date(firstCheckInMs);
    } else {
      // After the first check-in time, calculate based on intervals since the first check-in
      const elapsedSinceFirstCheckIn = nowMs - firstCheckInMs;
      const currentSlotIndex = Math.floor(elapsedSinceFirstCheckIn / intervalMs);

      // Calculate the start time of the current slot
      const currentSlotStartMs = firstCheckInMs + currentSlotIndex * intervalMs;
      const currentSlotEndMs = currentSlotStartMs + graceMs;

      // Check if guard has already completed this slot
      let isCurrentCompleted = false;
      if (activeShift.lastHeartbeatAt) {
        const lastHeartbeatMs = new Date(activeShift.lastHeartbeatAt).getTime();
        if (lastHeartbeatMs >= currentSlotStartMs) {
          isCurrentCompleted = true;
        }
      }

      if (nowMs > currentSlotEndMs) {
        // Missed current window, move to next slot
        nextDue = new Date(currentSlotStartMs + intervalMs);
      } else {
        // In current window
        if (isCurrentCompleted) {
          // Already checked in for this slot, move to next
          nextDue = new Date(currentSlotStartMs + intervalMs);
        } else {
          // Check in for current slot if possible
          nextDue = new Date(currentSlotStartMs);
        }
      }
    }

    const graceEndTime = new Date(nextDue.getTime() + graceMs);

    canCheckIn = currentTime >= nextDue && currentTime <= graceEndTime;

    if (currentTime < nextDue) {
      const diffSec = Math.ceil((nextDue.getTime() - currentTime.getTime()) / 1000);
      if (diffSec > 60) {
        windowMessage = `Check in dibuka dalam ${Math.ceil(diffSec / 60)} menit`;
      } else {
        windowMessage = `Check in dibuka dalam ${diffSec} detik`;
      }
    } else if (currentTime > graceEndTime) {
      windowMessage = 'Jendela terlewat';
    } else {
      windowMessage = 'Check-in Buka';
    }
  }

  const handleCheckIn = async () => {
    if (!activeShift) return;

    let locationData: { lat: number; lng: number } | undefined;

    if (navigator.geolocation) {
      setStatus('Mendapatkan lokasi...');
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          });
        });
        locationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      } catch (error) {
        console.warn('Geolocation failed or timed out:', error);
        // Continue without location
      }
    }

    setStatus('Check-in...');
    try {
      const res = await fetchWithAuth(`/api/shifts/${activeShift.id}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'web-ui',
          location: locationData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Error: ${data.message || data.error || 'Check-in gagal.'}`);
      } else {
        setStatus(`Berhasil Check-in! Status: ${data.status}`);
        fetchShift();
      }
    } catch (err) {
      setStatus('Kesalahan Jaringan');
      console.error('Network error during check-in:', err);
    }
  };

  return (
    <div className="border rounded-lg shadow-sm p-6 bg-white mb-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500">Check-in Berikutnya Jatuh Tempo:</p>
        <p className="text-3xl font-mono font-bold text-blue-600">{nextDue ? nextDue.toLocaleTimeString() : '--:--'}</p>
        <p className="text-xs text-gray-400 mt-1">Masa tenggang: {activeShift?.graceMinutes} menit</p>
        <p className={`text-sm font-medium mt-2 ${canCheckIn ? 'text-green-600' : 'text-amber-600'}`}>
          {windowMessage}
        </p>
      </div>

      {canCheckIn && (
        <button
          onClick={handleCheckIn}
          className="w-full text-lg font-bold py-4 rounded-lg shadow transition-all active:scale-95 bg-green-600 hover:bg-green-700 text-white"
        >
          CHECK IN SEKARANG
        </button>
      )}

      {status && <p className="mt-4 text-center font-medium text-sm text-gray-700">{status}</p>}
    </div>
  );
}
