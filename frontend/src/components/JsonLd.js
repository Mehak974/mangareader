/**
 * Renders a JSON-LD structured-data script tag.
 *
 * The serialized JSON is escaped so a `<` inside any string value can't close
 * the surrounding <script> element and break out into executable markup.
 */
export default function JsonLd({ data }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
