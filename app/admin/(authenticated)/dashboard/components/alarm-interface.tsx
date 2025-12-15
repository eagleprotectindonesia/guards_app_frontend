'use client';

import { useEffect, useRef } from 'react';
import { Serialized } from '@/lib/utils';
import { Alert, Guard, Shift, ShiftType, Site } from '@prisma/client';

type SiteWithOptionalRelations = Serialized<Site>;
type ShiftTypeWithOptionalRelations = Serialized<ShiftType>;
type GuardWithOptionalRelations = Serialized<Guard>;

type ShiftWithOptionalRelations = Serialized<Shift> & {
  guard?: GuardWithOptionalRelations | null;
  shiftType?: ShiftTypeWithOptionalRelations;
};

type AlertWithRelations = Serialized<Alert> & {
  site?: SiteWithOptionalRelations;
  shift?: ShiftWithOptionalRelations;
};

interface AlarmInterfaceProps {
  alerts: AlertWithRelations[];
}

export default function AlarmInterface({ alerts }: AlarmInterfaceProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Alarm Audio Logic
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/audios/alarm.wav');
      audioRef.current.loop = true;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const hasActiveAlerts = alerts.some(alert => !alert.acknowledgedAt && !alert.resolvedAt);

    if (hasActiveAlerts) {
      if (audio.paused) {
        audio.play().catch(e => console.warn('Alarm playback failed/blocked:', e));
      }
    } else {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }, [alerts]);

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-xl shadow-sm border transition-colors ${
        alerts.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`p-3 rounded-full ${
            alerts.length > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {alerts.length > 0 ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          )}
        </div>
        <div>
          <h3 className={`font-bold ${alerts.length > 0 ? 'text-red-900' : 'text-gray-900'}`}>
            {alerts.length > 0 ? 'ALARM TRIGGERED' : 'System Normal'}
          </h3>
          <p className={`text-sm ${alerts.length > 0 ? 'text-red-700' : 'text-gray-500'}`}>
            {alerts.length > 0
              ? `${alerts.length} active alert${alerts.length === 1 ? '' : 's'} require attention`
              : 'No active alerts detected'}
          </p>
        </div>
      </div>
    </div>
  );
}
