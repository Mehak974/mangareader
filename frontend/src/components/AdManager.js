"use client";

import Script from "next/script";

const MONETAG_SCRIPT = `
(function(){
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  var inject = function(zone, src){
    var s = document.createElement('script');
    s.dataset.zone = zone;
    s.src = src;
    ([document.documentElement, document.body].filter(Boolean).pop()).appendChild(s);
  };
  if(isMobile){
    inject('11533092','https://al5sm.com/tag.min.js');
  } else {
    inject('11461253','https://nap5k.com/tag.min.js');
    inject('11532242','https://n6wxm.com/vignette.min.js');
  }
})();
`;

export default function AdManager() {
  return (
    <Script
      id="monetag-ads"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: MONETAG_SCRIPT }}
    />
  );
}
