import { buildMetadata } from "@/lib/seo";
import LegalNav from "@/components/LegalNav";

export const metadata = buildMetadata({
  title: "DMCA & Copyright",
  description: "Digital Millennium Copyright Act (DMCA) policy for MangaReader.pro.",
  path: "/dmca",
});

export default function DmcaPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <LegalNav />
        <h1>DMCA & Copyright Policy</h1>
        <p className="legal-subtitle">Compliance with the Digital Millennium Copyright Act.</p>
        
        <section>
          <h2>Data Ownership and Aggregation</h2>
          <p>
            MangaReader.pro is an automated metadata aggregator. The platform was built by a fan of the medium to provide a clean, ad-free interface for reading content that is already publicly distributed across the internet. 
          </p>
          <p>
            <strong>We do not host, store, or upload any comic images, manga, manhwa, or manhua files on our servers.</strong> All images and content displayed on this site are fetched dynamically via APIs from third-party hosting providers and scanlation groups. We do not claim any ownership over this content. All intellectual property rights remain strictly with the original creators, publishers, and distributors.
          </p>
        </section>

        <section>
          <h2>Takedown Requests</h2>
          <p>
            MangaReader.pro respects the intellectual property rights of others and complies with the Digital Millennium Copyright Act (DMCA). Because we do not host the files, we cannot delete them from the internet. However, we can quickly and permanently remove the links/indexes to the copyrighted material from our platform.
          </p>
          <p>
            If you represent a publisher or creator and wish for a series to be removed from our index, please provide a formal DMCA takedown notice containing the following information:
          </p>
          <ul>
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>The exact URL(s) on MangaReader.pro containing the infringing links.</li>
            <li>Information sufficient to permit us to contact the complaining party (name, address, email).</li>
            <li>A statement that the complaining party has a good faith belief that use of the material is not authorized by the copyright owner.</li>
            <li>A statement that the information in the notification is accurate, and under penalty of perjury, that the complaining party is authorized to act on behalf of the owner.</li>
          </ul>
        </section>

        <section>
          <h2>Contact for Takedowns</h2>
          <p>
            Please submit all DMCA notices and copyright concerns directly through our <a href="/contact" style={{ color: "var(--primary)" }}>Contact</a> page, selecting "DMCA / Copyright" as the subject. We process valid removal requests within 48 hours.
          </p>
        </section>
      </div>
    </div>
  );
}
