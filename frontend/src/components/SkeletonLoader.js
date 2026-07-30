export default function SkeletonLoader() {
  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ height: "30px", width: "150px", background: "var(--surface0)", borderRadius: "8px", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "16px" }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ width: "100%", aspectRatio: "2/3", background: "var(--surface0)", borderRadius: "8px", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></div>
            <div style={{ height: "16px", width: "80%", background: "var(--surface0)", borderRadius: "4px", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></div>
            <div style={{ height: "12px", width: "50%", background: "var(--surface0)", borderRadius: "4px", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}></div>
          </div>
        ))}
      </div>
    </div>
  );
}
