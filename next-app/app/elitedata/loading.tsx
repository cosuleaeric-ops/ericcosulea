export default function OverviewLoading() {
  return (
    <>
      <div className="dfa-skeleton" style={{ height: 30, width: "70%", maxWidth: 460, marginBottom: 24 }} />
      <div className="dfa-site-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="dfa-card dfa-site-card">
            <div className="dfa-skeleton" style={{ height: 16, width: 120 }} />
            <div className="dfa-skeleton" style={{ height: 56 }} />
            <div className="dfa-skeleton" style={{ height: 14, width: 80 }} />
          </div>
        ))}
      </div>
    </>
  );
}
