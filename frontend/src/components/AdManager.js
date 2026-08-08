"use client";

import { usePathname } from "next/navigation";

export default function AdManager() {
  const pathname = usePathname();

  // We use key={pathname} to force React to completely unmount and remount 
  // the iframe on EVERY page navigation. This guarantees Adcash treats every 
  // route change as a fresh, brand new page load!
  return (
    <div className="w-full flex justify-center py-4 bg-bg border-b border-white/5">
      <iframe 
        key={pathname}
        src="/adcash.html" 
        style={{ width: '100%', border: 'none', minHeight: '90px' }}
        scrolling="no"
        title="Advertisement"
      />
    </div>
  );
}
