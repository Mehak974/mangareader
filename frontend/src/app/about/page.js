import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
import Image from "next/image";
import LegalNav from "@/components/LegalNav";

export const metadata = buildMetadata({
  title: "About Us",
  description: "Learn about MangaReader.pro — built by a manga fan to provide an ad-free, massive library with a clean reading experience.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <LegalNav />
        <h1>About MangaReader.pro</h1>
        <p className="legal-subtitle">Built by a reader, for the readers.</p>
        
        <section style={{ marginTop: "2rem" }}>
          <h2>The Story Behind MangaReader</h2>
          <p>
            Hi there! I am a massive fan of manhwa, manhua, and webcomics. Like many of you, I spend hours immersed in incredible worlds, leveling systems, and deep storylines. But over the years, I started facing some major frustrations with the platforms available.
          </p>
          <p>
            If I found a website with a massive library and fast chapter updates, it was absolutely flooded with annoying pop-up ads, fake download buttons, and redirects. I felt like I was there just to watch ads, getting interrupted at every single step. 
          </p>
          <p>
            On the flip side, if I finally found a clean, ad-free platform, they almost always compromised on their range. They either had a very limited library or their chapter updates were incredibly slow. 
          </p>
          <p>
            To make matters worse, keeping track of what I was reading was a nightmare. I found it difficult to remember every manga I was currently reading or exactly which chapter I had left off on.
          </p>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2>Why I Built This Platform</h2>
          <p>
            I decided I had enough. I wanted to build a platform that solved every single problem I faced as a reader. 
          </p>
          <ul>
            <li><strong>Clean Experience:</strong> No intrusive pop-unders or malicious redirects. Ad-free reading experience.</li>
            <li><strong>Massive Library:</strong> A wide range of titles aggregated across the web, updated as fast as possible.</li>
            <li><strong>Seamless Tracking:</strong> Built-in library management so you always know exactly which chapter you are on.</li>
          </ul>
          <p>
            This site is my attempt to fix the manga reading experience. If you feel like I missed a feature or if you're facing any issues, please do let me know through the <Link href="/contact" style={{ color: "var(--primary)" }}>Contact</Link> page!
          </p>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2>Disclaimer & Data Ownership</h2>
          <p>
            I do not claim any of the manga, manhwa, or manhua data on this site as my own. All comic content belongs to their respective publishers, creators, and translators. This platform acts purely as an aggregator to provide a better reading interface. The only content I claim ownership of are the original articles posted on our <Link href="/blog" style={{ color: "var(--primary)" }}>Blog</Link>.
          </p>
        </section>

        <section style={{ marginTop: "2rem", padding: "1.5rem", background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", borderRadius: "12px" }}>
          <h2 style={{ borderBottom: "none", paddingBottom: 0, marginTop: 0, color: "#eab308" }}>Important: We Are Not Affiliated With Other Sites</h2>
          <p>
            <strong>MangaReader.pro</strong> is an independent project. We are <strong>not affiliated with, endorsed by, or connected to</strong> any other manga reading websites, including but not limited to <strong>MangaReader.to</strong>, MangaDex, MangaKatana, or any similarly named platforms.
          </p>
          <p>
            If you see similar domain names or branding, those are separate entities. We maintain our own infrastructure, content aggregation, and reading experience.
          </p>
        </section>

        <section style={{ marginTop: "2rem", padding: "1.5rem", background: "var(--bg2)", borderRadius: "12px", textAlign: "center" }}>
          <h2 style={{ borderBottom: "none", paddingBottom: 0, marginTop: 0 }}>Support The Project</h2>
          <p>
            Running a site of this scale is incredibly expensive due to server costs. If you love what I'm doing and want to help keep the site alive, consider supporting me! Even $1 means the world to me and helps keep the servers running.
          </p>
          <Link href="/support" className="btn btn-p" style={{ display: "inline-block", marginTop: "1rem", color: "black", textDecoration: "none" }}>
            Learn How to Support
          </Link>
        </section>
      </div>
    </div>
  );
}
