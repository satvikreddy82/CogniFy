import React from 'react';
import { Brain, TrendingUp, CheckCircle, XCircle, Edit2 } from 'lucide-react';

const MOCK_RECS = [
  { id: 1, co: 'CO3', attainment: 45, recommendation: 'CO3 attainment (45%) is below the target of 60%. Recommend including more "Apply" and "Analyze" level questions in future assessments to reinforce practical application of concepts.', status: 'pending' },
  { id: 2, co: 'CO1', attainment: 78, recommendation: 'CO1 is performing well. Consider increasing question complexity to "Evaluate" and "Create" levels to further challenge high-achievers.', status: 'accepted' },
];

export default function AdaptivePlanningPage() {
  const [recs, setRecs] = React.useState(MOCK_RECS);

  const decide = (id: number, decision: 'accepted' | 'rejected') => {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, status: decision } : r));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Adaptive Planning</h1>
        <p className="text-sm text-muted mt-1">AI-generated recommendations based on CO attainment analysis</p>
      </div>

      <div className="card p-5 flex gap-3" style={{ borderLeft: '3px solid var(--primary)' }}>
        <Brain className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--primary)' }} />
        <div>
          <p className="text-sm font-medium text-default">How adaptive planning works</p>
          <p className="text-xs text-muted mt-0.5">After marks are submitted, the AI analyses CO attainment patterns and generates actionable recommendations. You can accept, reject, or modify each suggestion before it influences future paper generation.</p>
        </div>
      </div>

      <div className="space-y-4">
        {recs.map(rec => (
          <div key={rec.id} className={`card p-5 transition-all ${rec.status === 'rejected' ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge badge-primary font-mono">{rec.co}</span>
                  <span className={`badge ${rec.attainment < 60 ? 'badge-error' : rec.attainment < 75 ? 'badge-warning' : 'badge-success'}`}>
                    {rec.attainment}% attainment
                  </span>
                  {rec.status !== 'pending' && (
                    <span className={`badge ${rec.status === 'accepted' ? 'badge-success' : 'badge-error'} capitalize`}>{rec.status}</span>
                  )}
                </div>
                <p className="text-sm text-default">{rec.recommendation}</p>
              </div>
              {rec.status === 'pending' && (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => decide(rec.id, 'accepted')} className="btn btn-secondary p-1.5" title="Accept">
                    <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                  </button>
                  <button onClick={() => decide(rec.id, 'rejected')} className="btn btn-secondary p-1.5" title="Reject">
                    <XCircle className="w-4 h-4" style={{ color: 'var(--error)' }} />
                  </button>
                  <button className="btn btn-secondary p-1.5" title="Edit">
                    <Edit2 className="w-4 h-4 text-muted" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 bg-surface-2 text-center">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30 text-muted" />
        <p className="text-sm text-muted">More recommendations will be generated after your next assessment's marks are uploaded and analysed.</p>
      </div>
    </div>
  );
}
