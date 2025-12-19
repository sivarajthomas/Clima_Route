import React, { useEffect, useState } from 'react';
import { Card } from '../../components/Layout';
import { apiService } from '../../services/apiservice';

export default function RouteLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch delivery history and users, then combine
    const loadData = async () => {
      try {
        const [historyData, usersData] = await Promise.all([
          apiService.getHistory(),
          apiService.getUsers()
        ]);
        setUsers(usersData || []);
        
        // Map history with username - prefer backend driverName
        const enriched = (historyData || []).map((h: any) => {
          // Backend now returns driverName with case-insensitive lookup
          let userName = h.driverName;
          
          // Fallback: look up locally if backend didn't resolve
          if (!userName || userName === h.driverEmail) {
            const user = usersData?.find((u: any) => 
              u.email?.toLowerCase() === h.driverEmail?.toLowerCase()
            );
            userName = user?.name || h.driverEmail || 'Unknown';
          }
          
          return {
            ...h,
            userName: userName,
            fleetId: `FLT-${1000 + h.id}` // Generate fleet ID from history ID
          };
        });
        setLogs(enriched);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Delivery History</h2>
      <Card className="!p-0 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading logs...</div> : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No delivery history found</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Origin</th>
                <th className="px-6 py-4">Destination</th>
                <th className="px-6 py-4">Weather</th>
                <th className="px-6 py-4">Distance</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-6 py-4 text-gray-600">{log.date} {log.startTime}</td>
                  <td className="px-6 py-4 font-medium text-gray-800">{log.userName}</td>
                  <td className="px-6 py-4 text-gray-600">{log.origin}</td>
                  <td className="px-6 py-4 text-gray-600">{log.destination}</td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600">{log.weather}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{log.distance}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      log.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      log.status === 'Delayed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}