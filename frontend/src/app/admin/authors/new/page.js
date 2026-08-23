import AuthorEditor from "@/components/admin/AuthorEditor";
export const metadata = { title: "New author · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function NewAuthorPage() {
  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">New author</h1>
          <p className="admin-page-sub">Create a byline persona for editorial content.</p>
        </div>
      </header>
      <AuthorEditor initial={null} />
    </div>
  );
}
