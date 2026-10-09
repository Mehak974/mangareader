import AAdsInline from "@/components/AAdsInline";

export const metadata = {
  title: "Advertisements",
  robots: {
    index: true,
    follow: true,
  },
};

export default function AadsPage() {
  // Sticky 728x90 banner is rendered at the bottom via root layout (AAdsBanner).
  // The 300x250 inline unit is rendered here in the center of the page all the time.
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#0A0612",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px 120px",
      }}
    >
      <div style={{ margin: "auto 0" }}>
        <AAdsInline force={true} />
      </div>
    </div>
  );
}