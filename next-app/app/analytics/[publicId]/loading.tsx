export default function DashboardLoading() {
  return (
    <div className="dfa-dashboard">
      <div className="dfa-skeleton" style={{ height: 34, width: "100%", maxWidth: 520 }} />
      <div className="dfa-kpi-row">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="dfa-card dfa-kpi">
            <div className="dfa-skeleton" style={{ height: 12, width: 56 }} />
            <div className="dfa-skeleton" style={{ height: 24, width: 72 }} />
          </div>
        ))}
      </div>
      <div className="dfa-card dfa-chart-card">
        <div className="dfa-skeleton" style={{ height: 300 }} />
      </div>
      <div className="dfa-panels-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dfa-card dfa-panel">
            <div className="dfa-skeleton" style={{ height: 280, margin: 12 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
