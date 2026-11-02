import { headers } from "next/headers";

export const metadata = {
  title: "Advertisements",
  robots: {
    index: true,
    follow: true,
  },
};

export default async function AadsPage() {
  const headersList = await headers();
  const host = (headersList.get("x-forwarded-host") || headersList.get("host") || "").toLowerCase();

  let unitId = "2454751";
  if (host.includes("mangaread.pro")) {
    unitId = "2455860";
  } else if (host.includes("manireader.online") || host.includes("manireader.pro")) {
    unitId = "2455863";
  }

  const closeId = `aadssticky-${unitId}`;

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
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", textAlign: "center", fontSize: 0, zIndex: 100 }}>
        <input autoComplete="off" type="checkbox" id={closeId} hidden />
        <div style={{ paddingTop: 0, paddingBottom: "auto" }}>
          <div style={{ width: "100%", height: "auto", position: "fixed", textAlign: "center", fontSize: 0, bottom: 0, left: 0, right: 0, margin: "auto" }}>
            <label
              htmlFor={closeId}
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
                data-aa={unitId}
                src={`//acceptable.a-ads.com/${unitId}/?size=Adaptive&background_color=transparent`}
                style={{ border: 0, padding: 0, width: "70%", height: "auto", overflow: "hidden", margin: "auto" }}
              />
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `
            #${closeId}:checked + div {
              display: none;
            }
          `}} />
        </div>
      </div>
    </div>
  );
}
