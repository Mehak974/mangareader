import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Cookie Policy",
  description: "How MangaReader uses cookies to remember your preferences and keep you signed in.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Cookie Policy</h1>
        <p className="legal-updated">Last updated: January 2026</p>
        <section>
          <h2>What Are Cookies</h2>
          <p>Cookies are small text files stored on your device when you visit a website. We use cookies to keep you signed in and remember your preferences.</p>
        </section>
        <section>
          <h2>Cookies We Use</h2>
          <h3>Essential Cookies</h3>
          <p>Required for the site to function. Includes your session token (keeps you logged in) and security tokens.</p>
          <table className="legal-table">
            <thead><tr><th>Cookie</th><th>Purpose</th><th>Duration</th></tr></thead>
            <tbody>
              <tr><td>__session</td><td>Keeps you signed in</td><td>30 days</td></tr>
              <tr><td>__csrf</td><td>Security protection</td><td>Session</td></tr>
            </tbody>
          </table>
          <h3>Preference Storage (localStorage)</h3>
          <p>Your reading preferences (bookmarks, history, theme, chapter progress) are stored locally in your browser under the key <code>mr:state</code>. This data never leaves your device and is not transmitted to our servers.</p>
        </section>
        <section>
          <h2>Third-Party Cookies</h2>
          <p>If ads are displayed, Google AdSense may set advertising cookies. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.</p>
        </section>
        <section>
          <h2>Managing Cookies</h2>
          <p>You can clear cookies and localStorage via your browser settings. Note: clearing cookies will sign you out.</p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>Questions? <a href="/contact">Contact us</a>.</p>
        </section>
      </div>
    </div>
  );
}
