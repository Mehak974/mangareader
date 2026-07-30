import { buildMetadata } from "@/lib/seo";
import LegalNav from "@/components/LegalNav";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description: "Read how MangaReader.pro protects your data. A reader-first platform respecting your privacy.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <LegalNav />
        <h1>Privacy Policy</h1>
        <p className="legal-subtitle">Effective Date: {new Date().toLocaleDateString()}</p>
        
        <section>
          <h2>1. A Reader-First Approach to Privacy</h2>
          <p>
            Hi, I built MangaReader.pro because I love manhwa and manga, and I hate how modern websites harvest your data just to show you annoying pop-up ads. Because this platform is built by a reader for readers, your privacy is treated with the utmost respect. I only collect the absolute minimum data required to make features like reading history and bookmarks work.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <ul>
            <li><strong>Account Information:</strong> If you choose to create an account to save your reading history, we collect your email address and an encrypted password. We do not sell this email.</li>
            <li><strong>Reading Data:</strong> We store which chapters you have read and which series you bookmark so you never lose your place.</li>
            <li><strong>Analytics:</strong> We use basic, privacy-respecting analytics to see which pages are popular and ensure the servers don't crash under load. This data is anonymized.</li>
          </ul>
        </section>

        <section>
          <h2>3. Cookies and Tracking</h2>
          <p>
            MangaReader uses strictly necessary cookies to keep you logged in. We also work with ad networks (like Monetag) to serve clean banner ads that pay for the server costs. These third-party networks may use cookies to serve non-intrusive ads. Unlike other platforms, we actively block malicious or pop-up ad networks.
          </p>
        </section>

        <section>
          <h2>4. Data Retention and Deletion</h2>
          <p>
            Your data belongs to you. If you want to delete your account, you can do so at any time from the Settings page. Deleting your account instantly and permanently removes your email, reading history, and bookmarks from our database.
          </p>
        </section>

        <section>
          <h2>5. Contact Us</h2>
          <p>
            If you have any questions or concerns regarding your privacy or how your data is handled, please reach out to me via the <a href="/contact" style={{ color: "var(--primary)" }}>Contact</a> page.
          </p>
        </section>
      </div>
    </div>
  );
}
