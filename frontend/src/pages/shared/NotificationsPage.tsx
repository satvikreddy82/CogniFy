import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Clock, FileText, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { api } from '../../services/api';

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default">Notifications</h1>
          <p className="text-sm text-muted">Stay up to date with paper reviews, approvals, and departmental activities.</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="btn btn-outline text-xs flex items-center gap-1.5 self-start sm:self-auto"
          >
            <CheckCheck className="w-3.5 h-3.5 text-primary" /> Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-default mb-1">No notifications yet</h3>
          <p className="text-sm text-muted">You're completely caught up with all tasks and updates!</p>
        </div>
      ) : (
        <div className="card divide-y divide-border border border-border overflow-hidden">
          {notifications.map((item: any) => {
            const isUnread = !item.is_read;
            const type = item.type || '';
            const isSuccess = type.includes('approved');
            const isDanger = type.includes('rejected');
            const isWarning = type.includes('pending') || type.includes('submitted');

            return (
              <div
                key={item.id}
                className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                  isUnread ? 'bg-primary/5' : 'hover:bg-surface-2/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isSuccess ? (
                      <CheckCircle className="w-5 h-5 text-success" />
                    ) : isDanger ? (
                      <AlertCircle className="w-5 h-5 text-danger" />
                    ) : isWarning ? (
                      <Clock className="w-5 h-5 text-warning" />
                    ) : (
                      <Info className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-default text-sm capitalize">
                        {type.replace(/_/g, ' ') || 'System Notice'}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      {item.payload?.comment ||
                        item.payload?.reason ||
                        item.payload?.applicant_name
                          ? `Update related to ${item.payload?.applicant_name || 'your submission'}.`
                          : 'You have a new update regarding your OBE assessments.'}
                    </p>
                    <span className="text-[10px] text-muted font-mono block">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {isUnread && (
                  <button
                    onClick={() => markReadMutation.mutate(item.id)}
                    className="btn btn-outline text-[11px] py-1 px-2.5 hover:bg-surface-2"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
