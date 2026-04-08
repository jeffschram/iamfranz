import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { MarkdownContent } from "../components/MarkdownContent";

export function ArtworkDetail() {
  const { id } = useParams<{ id: string }>();
  const artwork = useQuery(api.artworks.getById, { id: id as Id<"artworks"> });

  if (!artwork) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  // Use statement if available, fall back to description for older works
  const hasStatement = !!artwork.statement?.trim();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="lg:sticky lg:top-24">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {artwork.imageUrl ? (
              <img
                src={artwork.imageUrl}
                alt={artwork.pieceTitle ?? artwork.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-black mb-1.5">{artwork.pieceTitle ?? artwork.title}</h1>
            <p className="text-sm text-gray-500">
              {artwork.year} · {artwork.medium}
            </p>
            <Link to="/about" className="text-sm text-gray-500 hover:text-black transition-colors">
              IAMFRANZ
            </Link>
          </div>

          {hasStatement ? (
            <MarkdownContent
              content={artwork.statement!}
              className="prose prose-sm prose-gray max-w-none"
              stripFirstH1
            />
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">{artwork.description}</p>
          )}

          {artwork.prompt && (
            <details className="border border-gray-200 rounded-md bg-gray-50">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-black marker:text-gray-500">
                Show prompt
              </summary>
              <div className="px-4 pb-4">
                <pre className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">
{artwork.prompt}
                </pre>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
