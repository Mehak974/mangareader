import AAdsBanner from "@/components/AAdsBanner";
import BottomBanner from "@/components/BottomBanner";

export const metadata = {
  title: "Advertisements",
  robots: {
    index: true,
    follow: true,
  },
};

export default function AadsPage() {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#0A0612" }}>
      <AAdsBanner />
      <div style={{ height: "40vh" }} />
      <BottomBanner />
    </div>
  );
}