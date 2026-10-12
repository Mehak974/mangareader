export const metadata = {
  title: "MangaRead Advertisements (300x250)",
  robots: {
    index: true,
    follow: true,
  },
};

export default function MangaRead300Page() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#0C1220",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      {/* BEGIN AADS AD UNIT 2458319 */}
      <div id="frame" style={{ width: "300px", margin: "auto", zIndex: 99998, height: "auto" }}>
        <iframe
          data-aa="2458319"
          src="//ad.a-ads.com/2458319/?size=300x250&background_color=transparent"
          style={{ border: 0, padding: 0, width: "300px", height: "250px", overflow: "hidden", display: "block", margin: "auto" }}
        />
      </div>
      {/* END AADS AD UNIT 2458319 */}
    </div>
  );
}
