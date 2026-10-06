export const metadata = {
  title: "Advertisements",
  robots: {
    index: true,
    follow: true,
  },
};

export default function AadsPage() {
  // The sticky 728x90 banner comes from the root layout (AAdsBanner),
  // which already renders on every non-reader page including /aads.
  // useAdMode() pins /aads to 'sticky', so the layout banner is
  // guaranteed here — rendering a second AAdsBanner in this page
  // would stack two fixed 728x90 units and fire two ad requests.
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#0A0612" }}>
      <div style={{ height: "40vh" }} />
    </div>
  );
}