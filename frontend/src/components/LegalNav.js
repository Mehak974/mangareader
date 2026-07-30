"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LegalNav() {
  const pathname = usePathname();
  
  const links = [
    { name: "About", path: "/about" },
    { name: "Support", path: "/support" },
    { name: "Contact", path: "/contact" },
    { name: "FAQ", path: "/faq" },
    { name: "Privacy", path: "/privacy" },
    { name: "Terms", path: "/terms" },
    { name: "DMCA", path: "/dmca" },
  ];

  return (
    <nav style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "10px",
      marginBottom: "2rem",
      borderBottom: "1px solid var(--border)",
      paddingBottom: "1rem",
      justifyContent: "center"
    }}>
      {links.map(link => {
        const isActive = pathname === link.path;
        return (
          <Link 
            key={link.name} 
            href={link.path}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              background: isActive ? "var(--primary)" : "var(--bg)",
              color: isActive ? "#fff" : "var(--text2)",
              textDecoration: "none",
              fontWeight: isActive ? "bold" : "normal",
              fontSize: "0.9rem",
              transition: "all 0.2s"
            }}
          >
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}
