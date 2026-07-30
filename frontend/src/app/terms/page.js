import { buildMetadata } from "@/lib/seo";
import LegalNav from "@/components/LegalNav";

export const metadata = buildMetadata({
  title: "Terms of Service",
  description: "Terms and conditions for using MangaReader.pro. Please read carefully.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <LegalNav />
        <h1>Terms of Service</h1>
        <p className="legal-subtitle">Effective Date: {new Date().toLocaleDateString()}</p>
        
        <section>
          <h2>1. Introduction</h2>
          <p>
            Welcome to MangaReader.pro. By accessing or using our platform, you agree to be bound by these Terms of Service. This platform was created by a fellow manga/manhwa reader to solve common problems like intrusive ads and poor library management, providing a cleaner, faster reading experience.
          </p>
        </section>

        <section>
          <h2>2. Data Ownership & Disclaimer</h2>
          <p>
            <strong>We do not claim ownership of the comic data on this site.</strong> MangaReader.pro acts strictly as an aggregator and indexing service. All manga, manhwa, manhua, images, characters, and storylines belong entirely to their respective authors, artists, publishers, and translation groups. We do not host the image files on our own servers; we merely provide a specialized browser to view content publicly available on the internet. 
          </p>
          <p>
            The only content claimed as original property by MangaReader.pro are the editorial articles and blogs posted by our admin team.
          </p>
        </section>

        <section>
          <h2>3. User Accounts</h2>
          <p>
            Users may create accounts to save reading history and bookmarks. You are responsible for maintaining the security of your account credentials. We reserve the right to terminate accounts that attempt to abuse our API, scrape our frontend, or engage in malicious activity.
          </p>
        </section>

        <section>
          <h2>4. Advertisements & Support</h2>
          <p>
            To cover the heavy server costs of running a large-scale library, we display non-intrusive banner ads. We strictly prohibit malicious pop-ups. Users may also choose to financially support the site via donations. Donations are voluntary and non-refundable, serving to keep the servers online for everyone.
          </p>
        </section>

        <section>
          <h2>5. Limitation of Liability</h2>
          <p>
            MangaReader.pro is provided "as is" without warranties of any kind. We cannot guarantee that third-party image servers will always be online, nor can we guarantee uninterrupted access to specific chapters, as we do not control the source files. 
          </p>
        </section>

        <section>
          <h2>6. Contact</h2>
          <p>
            For questions about these terms, please reach out via our <a href="/contact" style={{ color: "var(--primary)" }}>Contact</a> page.
          </p>
        </section>
      </div>
    </div>
  );
}
