'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShiftWithRelations } from '@/app/admin/(authenticated)/shifts/components/shift-list'; // Assuming this type is available and suitable
import { useGuardApi } from '@/app/guard/(authenticated)/hooks/use-guard-api'; // Adjust import path as necessary
import { format } from 'date-fns';

interface AttendanceRecordProps {
  shift: ShiftWithRelations;
  onAttendanceRecorded: () => void;
  status: string; // Current status of the shift, e.g., 'active', 'pending attendance', etc.
  setStatus: (status: string) => void;
  currentTime?: Date; // Optional for backward compatibility, but recommended
}

export function AttendanceRecord({ shift, onAttendanceRecorded, status, setStatus, currentTime }: AttendanceRecordProps) {
  const { fetchWithAuth } = useGuardApi();
  const [isRecording, setIsRecording] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const handleRecordAttendance = async () => {
    setIsRecording(true);
    setMessage('');
    setMessageType('');
    try {
      const res = await fetchWithAuth(`/api/shifts/${shift.id}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shiftId: shift.id }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to record attendance');
      }

      setMessage('Attendance recorded successfully!');
      setMessageType('success');
      onAttendanceRecorded(); // Notify parent component to refresh shift data
      setStatus('Attendance Recorded'); // Update local status
    } catch (error: any) {
      console.error('Error recording attendance:', error);
      setMessage(error.message || 'An unexpected error occurred.');
      setMessageType('error');
    } finally {
      setIsRecording(false);
    }
  };

  // Determine if attendance can be recorded
  const hasAttendance = !!shift.attendance;
  const canRecordAttendance = !hasAttendance;

  // Calculate late status
  const ATTENDANCE_GRACE_MINS = 5;
  const now = currentTime || new Date();
  const startMs = new Date(shift.startsAt).getTime();
  const graceEndMs = startMs + ATTENDANCE_GRACE_MINS * 60000;
  const isLate = !hasAttendance && now.getTime() > graceEndMs;

  return (
    <div className={`p-4 border rounded-lg shadow-sm mb-4 ${isLate ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      <h3 className="text-lg font-semibold mb-2">Attendance Status</h3>
      {hasAttendance ? (
        <p className="text-green-600 font-medium">
          Attendance recorded at {format(new Date(shift.attendance!.recordedAt), 'MM/dd/yyyy HH:mm')}
        </p>
      ) : isLate ? (
        <p className="text-red-600 font-bold">Attendance Missing</p>
      ) : (
        <p className="text-red-500 font-medium">Please record your attendance to start the shift.</p>
      )}

      {message && (
        <p className={`mt-2 text-sm ${messageType === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
      )}

      {!hasAttendance && !isLate && (
        <>
          <Button
            onClick={handleRecordAttendance}
            disabled={isRecording || !canRecordAttendance}
            className="mt-4 w-full"
          >
            {isRecording ? 'Recording...' : 'Record Attendance'}
          </Button>
          {!canRecordAttendance && (
            <p className="text-sm text-gray-500 mt-2">Attendance has already been recorded for this shift.</p>
          )}
        </>
      )}

      {isLate && !hasAttendance && (
        <p className="text-red-600 mt-2 font-medium">
          Attendance window missed. Please contact your administrator.
        </p>
      )}
    </div>
  );
}
