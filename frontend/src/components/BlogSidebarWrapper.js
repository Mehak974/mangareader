"use client";

import dynamic from "next/dynamic";

const BlogSidebar = dynamic(() => import("./BlogSidebar"), { ssr: false });

export default function BlogSidebarWrapper(props) {
  return <BlogSidebar {...props} />;
}
