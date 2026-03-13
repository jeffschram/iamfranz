import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

type Artwork = {
  _id: string;
  title: string;
  pieceTitle?: string | null;
  imageUrl?: string | null;
  artist?: { name?: string | null } | null;
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

export function Home() {
  const artworks = useQuery(api.artworks.list) as Artwork[] | undefined;

  if (!artworks) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!artworks.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">Latest work</p>
        <h1 className="text-3xl font-semibold text-black mb-3">IAMFRANZ</h1>
        <p className="text-base text-gray-600">No published works yet.</p>
      </div>
    );
  }

  const latest = [...artworks].sort((a, b) => a.title.localeCompare(b.title)).at(-1)!;
  const displayTitle = latest.pieceTitle ?? latest.title;
  const displayDate = extractDisplayDate(latest.title);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="flex mb-8 justify-center">
        <Link to={`/work/${latest._id}`} className="block w-full max-w-2xl">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {latest.imageUrl ? (
              <img
                src={latest.imageUrl}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>
        </Link>
      </div>
      <div className="text-center">        
        <h1 className="text-2xl sm:text-3xl font-semibold text-black mb-2">
          <Link to={`/work/${latest._id}`} className="hover:text-gray-700 transition-colors">
            {displayTitle}
          </Link>
        </h1>
        {displayDate ? (
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">{displayDate}{" • "}
          <Link to="/about" className="hover:text-black transition-colors">
            IAMFRANZ
          </Link>
          </p>
        ) : null}        
      </div>
    </div>
  );
}
