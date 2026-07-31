"use client";

import { usePathname, useSearchParams } from "next/navigation";

export default function AdCashBanner({ zoneId = '11874874' }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Create the HTML content for the iframe
  const iframeContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; }
        </style>
      </head>
      <body>
        <script id="aclib" type="text/javascript" src="//acscdn.com/script/aclib.js"></script>
        <script type="text/javascript">
          aclib.runBanner({
              zoneId: '${zoneId}',
          });
        </script>
      </body>
    </html>
  `;

  return (
    <div className="adcash-banner-container" style={{ textAlign: "center", margin: "16px auto", minHeight: "90px", display: "flex", justifyContent: "center", width: "100%" }}>
      <iframe 
        title="AdCash Banner"
        style={{ width: "100%", height: "90px", border: "none", overflow: "hidden" }}
        scrolling="no"
        srcDoc={iframeContent}
        sandbox="allow-scripts allow-popups"
      />
    </div>
  );
}
