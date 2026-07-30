export default function Loading() {
  return (
    <div className="blog-layout" style={{ marginTop: "40px" }}>
      <article className="blog-main">
        {/* Skeleton for back button */}
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "60px", height: "28px", marginBottom: "20px" }}></div>
        
        {/* Skeleton for date/category */}
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "120px", height: "14px", marginBottom: "10px" }}></div>
        
        {/* Skeleton for title */}
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "100%", height: "40px", marginBottom: "12px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "80%", height: "40px", marginBottom: "20px" }}></div>
        
        {/* Skeleton for author info */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "26px", paddingBottom: "18px", borderBottom: "1px solid var(--border)" }}>
          <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-full" style={{ width: "34px", height: "34px" }}></div>
          <div style={{ flex: 1 }}>
            <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "100px", height: "14px", marginBottom: "6px" }}></div>
            <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "140px", height: "12px" }}></div>
          </div>
        </div>

        {/* Skeleton for cover image */}
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded-xl" style={{ width: "100%", aspectRatio: "16/9", marginBottom: "28px" }}></div>

        {/* Skeleton for paragraphs */}
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "100%", height: "16px", marginBottom: "12px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "95%", height: "16px", marginBottom: "12px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "90%", height: "16px", marginBottom: "24px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "100%", height: "16px", marginBottom: "12px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "92%", height: "16px", marginBottom: "12px" }}></div>
      </article>

      {/* Skeleton for sidebar */}
      <aside className="blog-sidebar" style={{ marginTop: "60px" }}>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "100%", height: "20px", marginBottom: "16px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "80%", height: "14px", marginBottom: "12px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "70%", height: "14px", marginBottom: "12px" }}></div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "85%", height: "14px", marginBottom: "12px" }}></div>
        
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded" style={{ width: "100%", height: "120px", marginTop: "32px", borderRadius: "12px" }}></div>
      </aside>
    </div>
  );
}
