"use client";

import { useRef, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function AdCashBanner({ zoneId = '11874874' }) {
  const iframeRef = useRef(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!iframeRef.current) return;
    
    // Create the HTML content for the iframe
    const iframeContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; }
          </style>
          <script id="aclib" type="text/javascript" src="//acscdn.com/script/aclib.js"></script>
        </head>
        <body>
          <script type="text/javascript">
            aclib.runBanner({
                zoneId: '${zoneId}',
            });
          </script>
        </body>
      </html>
    `;
    
    // Write the content directly to the iframe document
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(iframeContent);
      doc.close();
    }
  }, [zoneId, pathname, searchParams]);

  return (
    <div className="adcash-banner-container" style={{ textAlign: "center", margin: "16px auto", minHeight: "90px", display: "flex", justifyContent: "center", width: "100%" }}>
      <iframe 
        ref={iframeRef}
        title="AdCash Banner"
        style={{ width: "100%", height: "90px", border: "none", overflow: "hidden" }}
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
