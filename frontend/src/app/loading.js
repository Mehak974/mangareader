import SkeletonLoader from "@/components/SkeletonLoader";

export default function Loading() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", paddingTop: "64px" }}>
      <SkeletonLoader />
    </div>
  );
}
