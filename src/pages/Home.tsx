import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

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

export function Home() {
  const featured = useQuery(api.artworks.getFeatured);

  if (!featured) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  const artwork = featured[0];

  if (!artwork) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-base text-gray-500">No featured work yet.</p>
      </div>
    );
  }

  const displayTitle = artwork.pieceTitle ?? artwork.title;
  const displayDate = extractDisplayDate(artwork.title);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to={`/work/${artwork._id}`} className="block w-full">
        {artwork.imageUrl ? (
          <img
            src={artwork.imageUrl}
            alt={displayTitle}
            className="w-full aspect-square object-cover block"
            loading="eager"
          />
        ) : (
          <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
            No image
          </div>
        )}
      </Link>
      <Link to={`/work/${artwork._id}`} className="block mt-4 hover:opacity-60 transition-opacity">
        <h1 className="text-2xl sm:text-3xl font-semibold text-black mb-2 text-center">{displayTitle}</h1>
        {displayDate && (
          <p className="text-center text-sm text-gray-400 mt-0.5">{displayDate}</p>
        )}
      </Link>
    </div>
  );
}
