"use client";

import { usePathname } from "next/navigation";
import AAdsBanner from "@/components/AAdsBanner";

export default function AAdsBannerWrapper() {
  const pathname = usePathname();
  if (pathname === "/aads") return null;
  return <AAdsBanner />;
}
