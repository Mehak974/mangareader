import { buildMetadata } from "@/lib/seo";
import LegalNav from "@/components/LegalNav";
import Image from "next/image";

export const metadata = buildMetadata({
  title: "Support Us",
  description: "Help keep MangaReader alive and thriving by supporting our server costs.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <LegalNav />
        <h1>Support The Project</h1>
        <p className="legal-subtitle">Help keep MangaReader alive and thriving.</p>
        
        <section style={{ marginTop: "2rem" }}>
          <h2>Why We Need Your Help</h2>
          <p>
            MangaReader was created by a fellow manga fan to solve the massive problem of spammy, ad-filled aggregator sites. Our goal is to give you a massive library and fast updates without forcing you to deal with malicious pop-ups or paywalls.
          </p>
          <p>
            However, maintaining a platform of this scale, paying for fast servers, and ensuring chapters load instantly requires significant financial investment. 
          </p>
        </section>

        <section style={{ marginTop: "2rem", textAlign: "center", background: "var(--bg2)", padding: "2rem", borderRadius: "12px" }}>
          <h2 style={{ borderBottom: "none", paddingBottom: 0, marginTop: 0 }}>Every Dollar Counts</h2>
          <p style={{ maxWidth: "600px", margin: "0 auto 1.5rem auto" }}>
            If you enjoy the clean reading experience, the easy-to-use history tracking, and the vast library, please consider leaving a tip. <strong>Even $1 means a lot</strong> and goes directly toward paying the monthly server bills.
          </p>
          
          <div style={{ display: "inline-block", background: "white", padding: "1rem", borderRadius: "12px", border: "2px solid var(--border)" }}>
            <img 
              src="/paypal_scan.jpeg" 
              alt="PayPal QR Code for Support" 
              style={{ width: "250px", height: "250px", objectFit: "contain", borderRadius: "8px" }} 
            />
          </div>
          <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text2)" }}>
            Scan the QR code above with your phone's camera to support us via PayPal!
          </p>
        </section>

        <section style={{ marginTop: "3rem" }}>
          <h2>Other Ways to Help</h2>
          <p>If you can't support us financially right now, you can still make a huge impact!</p>
          <ul>
            <li><strong>Share the site:</strong> Tell your friends, post about us on Reddit, Discord, or X (Twitter). Word of mouth is our biggest growth engine.</li>
            <li><strong>Report bugs:</strong> If you find a missing chapter or a broken image, use the <a href="/contact" style={{ color: "var(--primary)" }}>Contact</a> page to let us know.</li>
            <li><strong>Whitelisting:</strong> If you use an ad-blocker, consider whitelisting our site. We promise to only use clean, non-intrusive banner ads that won't ruin your experience.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
