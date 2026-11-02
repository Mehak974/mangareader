import { headers } from "next/headers";

export const metadata = {
  title: "Advertisements (300x250)",
  robots: {
    index: true,
    follow: true,
  },
};

export default async function Aads300Page() {
  const headersList = await headers();
  const host = (headersList.get("x-forwarded-host") || headersList.get("host") || "").toLowerCase();

  let unitId = "2457490";
  if (host.includes("mangaread.pro")) {
    unitId = "2458319";
  } else if (host.includes("manireader.online") || host.includes("manireader.pro")) {
    unitId = "2459321";
  }

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
      <div id="frame" style={{ width: "300px", margin: "auto 0", zIndex: 99998, height: "auto" }}>
        <iframe
          data-aa={unitId}
          src={`//ad.a-ads.com/${unitId}/?size=300x250`}
          style={{
            border: 0,
            padding: 0,
            width: "300px",
            height: "250px",
            overflow: "hidden",
            display: "block",
            margin: "auto",
          }}
        />
      </div>
    </div>
  );
}
