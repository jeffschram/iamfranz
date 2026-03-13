import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";

type Artwork = {
  _id: string;
  title: string;
  pieceTitle?: string | null;
  imageUrl?: string | null;
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

function sortNewestFirst(artworks: Artwork[]): Artwork[] {
  return [...artworks].sort((a, b) => b.title.localeCompare(a.title));
}

export function Gallery() {
  const artworks = useQuery(api.artworks.list) as Artwork[] | undefined;

  if (!artworks) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  const sorted = sortNewestFirst(artworks);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">Archive</p>
        <h1 className="text-3xl font-semibold text-black mb-3">Selected works and studies</h1>
        <p className="text-base text-gray-600 max-w-2xl mx-auto">
          A public archive of IAMFRANZ images as the body of work develops over time.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No artworks available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {sorted.map((artwork) => {
            const displayTitle = artwork.pieceTitle ?? artwork.title;
            const displayDate = extractDisplayDate(artwork.title);

            return (
              <Link key={artwork._id} to={`/work/${artwork._id}`} className="group cursor-pointer">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                  {artwork.imageUrl ? (
                    <img
                      src={artwork.imageUrl}
                      alt={displayTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                  )}
                </div>
                <h2 className="font-medium text-base text-black group-hover:text-gray-600 transition-colors">
                  {displayTitle}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {displayDate ? `${displayDate} · ` : ""}IAMFRANZ
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
