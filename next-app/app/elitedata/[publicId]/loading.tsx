export default function DashboardLoading() {
  return (
    <div className="dfa-dashboard">
      <div className="dfa-skeleton" style={{ height: 34, width: "100%", maxWidth: 520 }} />
      <div className="dfa-card dfa-kpi-chart-panel">
        <div className="dfa-kpi-row">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dfa-kpi">
              <div className="dfa-skeleton" style={{ height: 14, width: 56 }} />
              <div className="dfa-skeleton" style={{ height: 26, width: 64 }} />
            </div>
          ))}
        </div>
        <div className="dfa-main-chart">
          <div className="dfa-skeleton" style={{ height: 380 }} />
        </div>
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
