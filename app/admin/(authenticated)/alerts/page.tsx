'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import AlertFeed, { AlertWithRelations } from '../components/alert-feed';
import PaginationNav from '../components/pagination-nav';
import AlertExport from '../components/alert-export';



type SSEAlertData =
  | { type: 'alert_created' | 'alert_updated'; alert: AlertWithRelations }
  | { type: 'alert_deleted'; alertId: string }
  | AlertWithRelations;

export default function AdminAlertsPage() {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '10', 10);

  const [alerts, setAlerts] = useState<AlertWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch alerts with pagination
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`/api/admin/alerts?page=${page}&per_page=${perPage}`);
        if (!res.ok) throw new Error('Failed to fetch alerts');
        const data = await res.json();
        setAlerts(data.data);
        setTotalCount(data.meta.total);
      } catch (err) {
        console.error('Error fetching alerts:', err);
      }
    };
    fetchAlerts();
  }, [page, perPage]);

  // Connect SSE for global alerts (real-time updates)
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Connect to the global alerts stream
    const es = new EventSource('/api/admin/alerts/stream');
    setConnectionStatus('Connecting...');

    es.onopen = () => setConnectionStatus('Connected');

    es.onerror = () => {
      setConnectionStatus('Reconnecting...');
    };

    es.addEventListener('backfill', () => {
      // no-op
    });

    es.addEventListener('alert', (e: MessageEvent) => {
      try {
        const data: SSEAlertData = JSON.parse(e.data);

        if ('type' in data) {
          if (data.type === 'alert_created') {
            // Only prepend if we are on the first page
            if (page === 1) {
              setAlerts(prev => {
                if (prev.find(a => a.id === data.alert.id)) return prev;
                const newAlerts = [data.alert, ...prev];
                // Optional: Truncate to perPage to keep page size consistent? 
                // Or just let it grow until refresh? Let's let it grow for now.
                return newAlerts;
              });
              setTotalCount(prev => prev + 1);
            } else {
              // If not on page 1, just increment total count
              setTotalCount(prev => prev + 1);
            }
          } else if (data.type === 'alert_updated') {
            setAlerts(prev => prev.map(a => (a.id === data.alert.id ? data.alert : a)));
          } else if (data.type === 'alert_deleted') {
            setAlerts(prev => prev.filter(a => a.id !== data.alertId));
            setTotalCount(prev => Math.max(0, prev - 1));
          }
        } else if ('id' in data) {
          // Fallback logic
           if (page === 1) {
              setAlerts(prev => [data, ...prev]);
              setTotalCount(prev => prev + 1);
           }
        }
      } catch (err) {
        console.error('Error parsing alert', err);
      }
    });

    eventSourceRef.current = es;

    return () => {
      es.close();
    };
  }, [page]); // Re-run if page changes to update the closure

  const handleResolve = (alertId: string) => {
    // Optimistic Update: remove the resolved alert from the list
    setAlerts(prev => prev.filter(a => a.id !== alertId));
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
          <AlertExport />
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

      <div className="flex-1 flex flex-col">
        <AlertFeed
          alerts={alerts}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          showResolutionDetails={true}
        />
        <PaginationNav page={page} perPage={perPage} totalCount={totalCount} />
      </div>
    </div>
  );
}