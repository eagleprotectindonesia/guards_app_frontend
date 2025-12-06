'use client';

import { useState, useEffect, useRef } from 'react';
import { Alert, Shift, Site, Guard, ShiftType } from '@prisma/client';
import { Serialized } from '@/lib/utils';
import AlertItem from '../components/alert-item';
import AlertResolutionModal from '../components/alert-resolution-modal';

type GuardWithOptionalRelations = Serialized<Guard>;
type ShiftTypeWithOptionalRelations = Serialized<ShiftType>;
type SiteWithOptionalRelations = Serialized<Site>;

type ShiftWithOptionalRelations = Serialized<Shift> & {
  guard?: GuardWithOptionalRelations | null;
  shiftType?: ShiftTypeWithOptionalRelations;
};

type AlertWithRelations = Serialized<Alert> & {
  site?: SiteWithOptionalRelations;
  shift?: ShiftWithOptionalRelations;
};

type SSEAlertData =
  | { type: 'alert_created' | 'alert_updated'; alert: AlertWithRelations }
  | { type: 'alert_deleted'; alertId: string }
  | AlertWithRelations;

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<AlertWithRelations[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Connect SSE for global alerts
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Connect to the global alerts stream (no siteId parameter)
    const es = new EventSource('/api/admin/alerts/stream');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectionStatus('Connecting...');

    es.onopen = () => setConnectionStatus('Connected');

    es.onerror = () => {
      setConnectionStatus('Reconnecting...');
    };

    es.addEventListener('backfill', (e: MessageEvent) => {
      try {
        const data: AlertWithRelations[] = JSON.parse(e.data);
        setAlerts(data);
      } catch (err) {
        console.error('Error parsing backfill', err);
      }
    });

    es.addEventListener('alert', (e: MessageEvent) => {
      try {
        const data: SSEAlertData = JSON.parse(e.data);

        if ('type' in data) {
          if (data.type === 'alert_created') {
            setAlerts(prev => {
              if (prev.find(a => a.id === data.alert.id)) return prev;
              return [data.alert, ...prev];
            });
          } else if (data.type === 'alert_updated') {
            setAlerts(prev => prev.map(a => (a.id === data.alert.id ? data.alert : a)));
          } else if (data.type === 'alert_deleted') {
            setAlerts(prev => prev.filter(a => a.id !== data.alertId));
          }
        } else if ('id' in data) {
          // Fallback for raw alert object (legacy?)
          setAlerts(prev => [data, ...prev]);
        }
      } catch (err) {
        console.error('Error parsing alert', err);
      }
    });

    eventSourceRef.current = es;

    return () => {
      es.close();
    };
  }, []);

  const handleResolve = (alertId: string) => {
    setSelectedAlertId(alertId);
  };

  const handleConfirmResolution = async (outcome: 'resolve' | 'forgive', note: string) => {
    if (!selectedAlertId) return;

    try {
      const body = { outcome, note };
      await fetch(`/api/admin/alerts/${selectedAlertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Optimistic Update
      setAlerts(prev => {
        return prev.map(a => {
          if (a.id !== selectedAlertId) return a;
          return {
            ...a,
            resolvedAt: new Date().toISOString(),
          };
        });
      });

      setSelectedAlertId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await fetch(`/api/admin/alerts/${alertId}/acknowledge`, { method: 'POST' });
      setAlerts(prev =>
        prev.map(a => {
          if (a.id !== alertId) return a;
          return {
            ...a,
            acknowledgedAt: new Date().toISOString(),
          };
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Alerts</h1>
          <p className="text-sm text-gray-500">Comprehensive view of all system alerts</p>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              connectionStatus === 'Connected'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'Connected' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {connectionStatus}
          </div>
        </div>
      </header>

      <div className="flex-1">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">All Clear</h3>
            <p className="text-gray-500">No active alerts at the moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
              />
            ))}
          </div>
        )}
      </div>

      <AlertResolutionModal
        isOpen={!!selectedAlertId}
        onClose={() => setSelectedAlertId(null)}
        onConfirm={handleConfirmResolution}
      />
    </div>
  );
}
