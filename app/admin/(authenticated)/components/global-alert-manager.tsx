'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAlerts } from '../context/alert-context';
import { X } from 'lucide-react';
import Link from 'next/link';

export default function GlobalAlertManager() {
  const { alerts } = useAlerts();
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Audio Logic
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

  const hasActiveAlerts = alerts.some(alert => !alert.acknowledgedAt && !alert.resolvedAt);

  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsBlocked(false);
              if (!hasActiveAlerts && !isMuted) {
                audioRef.current?.pause();
                if (audioRef.current) audioRef.current.currentTime = 0;
              }
              document.removeEventListener('click', unlockAudio);
              document.removeEventListener('keydown', unlockAudio);
            })
            .catch(error => {
              // console.warn('Audio unlock failed:', error);
            });
        }
      }
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, [hasActiveAlerts, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (hasActiveAlerts && !isMuted) {
      if (audio.paused) {
        audio.play().catch(() => {
          setIsBlocked(true);
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }, [hasActiveAlerts, isMuted]);

  const enableAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsBlocked(false);
        if (!hasActiveAlerts) {
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
        }
      });
    }
  };

  // If on dashboard, we don't show the visual alert (Dashboard handles it)
  // UNLESS audio is blocked, then we might want to show the 'Enable Audio' button even there?
  // Actually, let's keep it clean. If on dashboard, rely on Dashboard UI?
  // BUT we removed Audio logic from Dashboard. So Dashboard won't know if Audio is blocked.
  // So we should show "Audio Blocked" warning globally.

  const isOnDashboard = pathname === '/admin/dashboard';
  const isOnAlertsPage = pathname === '/admin/alerts';
  const showVisuals = !isOnDashboard && !isOnAlertsPage && hasActiveAlerts;

  if (!hasActiveAlerts && !isBlocked) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {/* Audio Blocked Warning - Always show if blocked and alerts exist */}
      {isBlocked && hasActiveAlerts && (
        <button
          onClick={enableAudio}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg shadow-lg hover:bg-red-700 animate-bounce flex items-center gap-2"
        >
          <span>Enable Alarm Audio</span>
        </button>
      )}

      {/* Floating Alert Card - Only if NOT on Dashboard */}
      {showVisuals && (
        <div className="bg-white border border-red-100 rounded-xl shadow-xl p-4 w-80 animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 text-red-600">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="font-bold">ALARM TRIGGERED</span>
            </div>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-400 hover:text-gray-600 text-xs underline"
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            {alerts.length} active alert{alerts.length === 1 ? '' : 's'} require immediate attention.
          </p>

          <div className="flex gap-2">
            <Link
              href="/admin/dashboard"
              className="flex-1 bg-red-600 text-white text-center py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
