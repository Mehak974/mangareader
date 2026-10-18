"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LegalNav() {
  const pathname = usePathname();
  
  const links = [
    { name: "About", path: "/about" },
    { name: "Support", path: "/support" },
    { name: "Contact", path: "/contact" },
    { name: "Messages", path: "/messages" },
    { name: "FAQ", path: "/faq" },
    { name: "Privacy", path: "/privacy" },
    { name: "Terms", path: "/terms" },
    { name: "DMCA", path: "/dmca" },
  ];

  return (
    <nav className="legal-nav">
      {links.map(link => {
        const isActive = pathname === link.path || (link.path === "/messages" && pathname?.startsWith("/messages"));
        return (
          <Link 
            key={link.name} 
            href={link.path}
            className={`legal-nav-link ${isActive ? "active" : ""}`}
          >
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}
