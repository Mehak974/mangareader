import AAdsInline from "@/components/AAdsInline";

export const metadata = {
  title: "Advertisements (300x250)",
  robots: {
    index: true,
    follow: true,
  },
};

export default function Aads300Page() {
  // Renders only the 300x250 banner ad in the center of the screen
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
        padding: "40px 20px",
      }}
    >
      <div style={{ margin: "auto 0" }}>
        <AAdsInline force={true} />
      </div>
    </div>
  );
}
