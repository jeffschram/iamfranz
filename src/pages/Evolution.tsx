import { usePaginatedQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { MarkdownContent } from "../components/MarkdownContent";

type Artwork = {
  _id: string;
  _creationTime: number;
  title: string;
  pieceTitle?: string | null;
  imageUrl?: string | null;
  statement?: string | null;
  artistThinking?: string | null;
  inspirationEntry?: string | null;
  evolutionEntry?: string | null;
  sortOrder?: number | null;
};

function extractDisplayDate(title: string): string | null {
  const match = title.match(/^(\d{4}-\d{2}-\d{2})\s+—/);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return match[1];
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function extractFirstParagraph(text: string): string | null {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("#"));
  return paragraphs[0] ?? null;
}

export function Evolution() {
  const { results: artworks, status, loadMore } = usePaginatedQuery(
    api.artworks.listEvolutionPage,
    {},
    { initialNumItems: 6 },
  );

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  if (!artworks.length) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-base text-gray-500">No published works yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      {artworks.map((artwork, index) => {
        const isLatest = index === 0;
        const isLast = status === "Exhausted" && index === artworks.length - 1;
        const displayTitle = artwork.pieceTitle ?? artwork.title;
        const displayDate = extractDisplayDate(artwork.title);
        const rawText = artwork.statement ?? artwork.artistThinking ?? null;
        const evolutionText = rawText ? extractFirstParagraph(rawText) : null;

        return (
          <div key={artwork._id} className="flex gap-5 sm:gap-8">
            {/* Timeline gutter: dot + connecting line */}
            <div className="flex flex-col items-center w-3 shrink-0">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                  isLatest ? "bg-gray-700" : "bg-gray-300"
                }`}
              />
              {!isLast && <div className="flex-1 w-px bg-gray-200 mt-1" />}
            </div>

            {/* Entry content */}
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 flex-1 min-w-0 pb-12 sm:pb-14">
              {/* Artwork image */}
              <Link to={`/work/${artwork._id}`} className="block shrink-0">
                <div className="w-full sm:w-48 aspect-square overflow-hidden bg-gray-100">
                  {artwork.imageUrl ? (
                    <img
                      src={artwork.imageUrl}
                      alt={displayTitle}
                      loading={isLatest ? "eager" : "lazy"}
                      className="w-full h-full object-cover transition-opacity duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
                      No image
                    </div>
                  )}
                </div>
              </Link>

              {/* Text */}
              <div className="flex-1 min-w-0 sm:pt-0.5">
                {isLatest && (
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-400 mb-2">
                    Latest Work
                  </p>
                )}
                {artwork.evolutionEntry && (
                  <div>
                    <MarkdownContent
                      content={artwork.evolutionEntry}
                      className="space-y-3 text-[14px] text-gray-500 leading-relaxed"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {status !== "Exhausted" && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => loadMore(6)}
            disabled={status === "LoadingMore"}
            className="border border-gray-300 px-5 py-2 text-sm font-medium text-black hover:bg-gray-50 disabled:cursor-wait disabled:text-gray-400"
          >
            {status === "LoadingMore" ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
