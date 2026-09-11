export const metadata = {
  title: "Advertisements",
  robots: {
    index: true,
    follow: true,
  },
};

export default function AadsPage() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", margin: 0, padding: 0, background: "#0A0612" }}>
      <div
        id="aads-frame"
        style={{
          width: "100%",
          maxWidth: "900px",
          margin: "0 auto",
          background: "#0A0612",
          display: "block",
          position: "relative",
          padding: "0",
          border: "none",
          overflow: "visible",
        }}
      >
        <iframe
          data-aa="2454751"
          src="https://acceptable.a-ads.com/2454751/?size=Adaptive&background_color=0A0612&title_color=A855F7&title_hover_color=A855F7"
          style={{
            border: 0,
            padding: 0,
            width: "100%",
            maxWidth: "800px",
            height: "250px",
            display: "block",
            margin: "0 auto",
            background: "#0A0612",
          }}
          title="Advertisement"
          scrolling="no"
          allow="autoplay"
        />
      </div>
    </div>
  );
}
