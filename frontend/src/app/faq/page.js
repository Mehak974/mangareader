import { buildMetadata, faqSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import LegalNav from "@/components/LegalNav";

export const metadata = buildMetadata({
  title: "FAQ — Frequently Asked Questions",
  description: "Answers to common questions about reading manga, manhwa, and manhua on MangaReader.",
  path: "/faq",
});

const FAQS = [
  { question: "Why is MangaReader.pro free?", answer: "Because I built this platform out of frustration. I was tired of sites that either charged money or flooded every single page with terrible, intrusive pop-up ads. Reading is completely free here, and the servers are supported entirely by clean, unobtrusive banner ads and reader donations." },
  { question: "Do I need an account to read?", answer: "Not at all! However, I highly recommend creating one. One of the reasons I built this site was because I kept forgetting what chapter I was on. A free account automatically tracks your reading history and lets you bookmark your favorite series." },
  { question: "Why is a chapter missing or broken?", answer: "MangaReader acts as an aggregator. Sometimes the original source we fetch from goes down or removes a chapter. If you see this, try switching the source on the manga page. If it's completely broken, let me know via the Contact page and I'll look into it!" },
  { question: "Are there going to be annoying pop-up ads?", answer: "No. Never. I am a manga reader myself and I hate those fake 'Download Now' buttons and redirects. We only use standard banner ads to keep the servers alive. If you ever see a pop-up, it's a rogue advertiser—please report it so I can block them." },
  { question: "How do I change reading direction?", answer: "Go to Settings → Reader → Reading Direction. You can swap between Right-to-left (manga), Left-to-right (manhwa/manhua), and Vertical scroll (webtoons)." },
  { question: "How can I support the site?", answer: "Server costs for a massive library are high. If you want to help keep the site ad-light and fast, you can support us via the PayPal QR code on the Support page. Even $1 goes a long way!" },
];

export default function FaqPage() {
  return (
    <div className="legal-page">
      <JsonLd data={faqSchema(FAQS)} />
      <div className="legal-container">
        <LegalNav />
        <h1>Frequently Asked Questions</h1>
        <div className="faq-list">
          {FAQS.map((faq, i) => (
            <details key={i} className="faq-item">
              <summary className="faq-question">{faq.question}</summary>
              <p className="faq-answer">{faq.answer}</p>
            </details>
          ))}
        </div>
        <div className="faq-footer">
          <p>Still have questions? <a href="/contact">Contact us</a>.</p>
        </div>
      </div>
    </div>
  );
}
