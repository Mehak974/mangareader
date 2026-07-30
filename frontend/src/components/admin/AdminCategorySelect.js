"use client";

import { useRouter } from "next/navigation";

export default function AdminCategorySelect({ tabs, currentCategory, currentStatus }) {
  const router = useRouter();

  const handleChange = (e) => {
    const newCategory = e.target.value;
    const params = new URLSearchParams();
    if (newCategory) params.set("category", newCategory);
    if (currentStatus) params.set("status", currentStatus);
    const qs = params.toString();
    router.push(`/admin/articles${qs ? `?${qs}` : ""}`);
  };

  return (
    <select
      value={currentCategory || ""}
      onChange={handleChange}
      className="admin-input"
      style={{ maxWidth: "400px", marginBottom: "20px" }}
    >
      {tabs.map((tab) => (
        <option key={tab.slug || "all"} value={tab.slug}>
          {tab.label}
        </option>
      ))}
    </select>
  );
}
