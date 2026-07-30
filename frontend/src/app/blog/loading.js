export default function Loading() {
  return (
    <div className="blog-layout" style={{ marginTop: "40px" }}>
      <main className="blog-main">
        {/* Skeleton for Title */}
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "250px", height: "40px", marginBottom: "20px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "100%", height: "20px", marginBottom: "40px", maxWidth: "500px" }}></div>

        <div style={{ display: "grid", gap: "32px", gridTemplateColumns: "1fr" }}>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "24px" }}>
              <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-xl" style={{ width: "200px", height: "130px", flexShrink: 0 }}></div>
              <div style={{ flex: 1, padding: "10px 0" }}>
                <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "80px", height: "14px", marginBottom: "12px" }}></div>
                <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "95%", height: "24px", marginBottom: "8px" }}></div>
                <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "70%", height: "24px", marginBottom: "16px" }}></div>
                <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "120px", height: "14px" }}></div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Skeleton for sidebar */}
      <aside className="blog-sidebar">
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "100%", height: "200px", borderRadius: "12px" }}></div>
      </aside>
    </div>
  );
}
