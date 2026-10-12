export const metadata = {
  title: "MangaRead Advertisements (Sticky)",
  robots: {
    index: true,
    follow: true,
  },
};

export default function MangaReadStickyPage() {
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
        padding: "40px 20px 120px",
      }}
    >
      {/* BEGIN AADS AD UNIT 2455860 */}
      <div style={{ position: "absolute", zIndex: 99999 }}>
        <input autocomplete="off" type="checkbox" id="aadsstickymv5gqie5" hidden />
        <div style={{ paddingTop: 0, paddingBottom: "auto" }}>
          <div style={{ width: "100%", height: "auto", position: "fixed", textAlign: "center", fontSize: 0, bottom: 0, left: 0, right: 0, margin: "auto" }}>
            <label
              htmlFor="aadsstickymv5gqie5"
              style={{
                top: "50%",
                transform: "translateY(-50%)",
                right: "24px",
                position: "absolute",
                borderRadius: "4px",
                background: "rgba(248, 248, 249, 0.70)",
                padding: "4px",
                zIndex: 99999,
                cursor: "pointer",
              }}
            >
              <svg fill="#000000" height="16px" width="16px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 490">
                <polygon points="456.851,0 245,212.564 33.149,0 0.708,32.337 212.669,245.004 0.708,457.678 33.149,490 245,277.443 456.851,490 489.292,457.678 277.331,245.004 489.292,32.337 " />
              </svg>
            </label>
            <div id="frame" style={{ width: "100%", margin: "auto", position: "relative", zIndex: 99998 }}>
              <iframe
                data-aa="2455860"
                src="//acceptable.a-ads.com/2455860/?size=Adaptive&background_color=transparent"
                style={{ border: 0, padding: 0, width: "70%", height: "auto", overflow: "hidden", margin: "auto" }}
              />
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            #aadsstickymv5gqie5:checked + div {
              display: none;
            }
          `}} />
        </div>
      </div>
      {/* END AADS AD UNIT 2455860 */}
    </div>
  );
}
