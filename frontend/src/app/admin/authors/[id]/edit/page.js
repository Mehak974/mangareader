import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AuthorEditor from "@/components/admin/AuthorEditor";

export const metadata = { title: "Edit author · Admin", robots: { index: false } };

export default async function EditAuthorPage({ params }) {
  const { id } = await params;
  const author = await prisma.editorialAuthor.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
      avatarUrl: true,
      credentials: true,
      socialLinks: true,
    },
  });

  if (!author) notFound();

  const initial = {
    id: author.id,
    slug: author.slug,
    name: author.name,
    bio: author.bio ?? "",
    avatarUrl: author.avatarUrl ?? "",
    credentials: author.credentials ?? "",
    socialLinks: author.socialLinks && typeof author.socialLinks === "object" ? author.socialLinks : {},
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Edit author</h1>
          <p className="admin-page-sub">{author.name}</p>
        </div>
      </header>
      <AuthorEditor initial={initial} />
    </div>
  );
}
