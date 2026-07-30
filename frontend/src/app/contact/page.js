"use client";
import { useState } from "react";
import LegalNav from "@/components/LegalNav";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus("sending"); setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Something went wrong."); setStatus("error"); return; }
      setStatus("ok");
    } catch { setError("Network error. Please try again."); setStatus("error"); }
  };

  if (status === "ok") return (
    <div className="legal-page">
      <div className="legal-container" style={{ textAlign: "center" }}>
        <LegalNav />
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h1>Message Sent!</h1>
        <p>We'll get back to you within 48 hours.</p>
        <button className="btn btn-p" onClick={() => { setStatus(null); setForm({ name:"",email:"",subject:"",message:"" }); }} style={{ marginTop: 24 }}>
          Send Another
        </button>
      </div>
    </div>
  );

  return (
    <div className="legal-page">
      <div className="legal-container" style={{ maxWidth: 640 }}>
        <LegalNav />
        <h1>Contact Us</h1>
        <p className="legal-subtitle">
          Got a suggestion, a bug report, or a manga recommendation? I'm always listening!
        </p>
        <p style={{ marginBottom: "2rem", color: "var(--text2)" }}>
          Because this platform is built by a fellow reader, your feedback directly shapes the future of MangaReader.pro. Whether a chapter failed to load, you have an idea for a new feature, or you just want to say hi, fill out the form below. I read every single message.
        </p>
        <form onSubmit={submit} className="contact-form">
          <div className="form-group">
            <label htmlFor="c-name">Name</label>
            <input id="c-name" name="name" type="text" value={form.name} onChange={change} placeholder="Your name" required className="form-input" />
          </div>
          <div className="form-group">
            <label htmlFor="c-email">Email</label>
            <input id="c-email" name="email" type="email" value={form.email} onChange={change} placeholder="your@email.com" required className="form-input" />
          </div>
          <div className="form-group">
            <label htmlFor="c-subject">Subject</label>
            <select id="c-subject" name="subject" value={form.subject} onChange={change} required className="form-input">
              <option value="">Select a subject</option>
              <option value="bug">Bug Report</option>
              <option value="dmca">DMCA / Copyright</option>
              <option value="missing-chapter">Missing Chapter</option>
              <option value="account">Account Issue</option>
              <option value="ads">Ad Problem</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="c-message">Message</label>
            <textarea id="c-message" name="message" value={form.message} onChange={change}
              placeholder="Describe your issue in detail — include the page URL if relevant." required className="form-input" rows={6} />
          </div>
          {error && <p className="form-error">⚠️ {error}</p>}
          <button type="submit" className="btn btn-p" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send Message"}
          </button>
        </form>
      </div>
    </div>
  );
}
