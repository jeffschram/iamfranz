import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

export function Full() {
  const featured = useQuery(api.artworks.getFeatured);

  if (!featured) {
    return (
      <div className="fixed inset-0 z-[100] flex justify-center items-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  const artwork = featured[0];

  if (!artwork) {
    return (
      <div className="fixed inset-0 z-[100] flex justify-center items-center bg-white">
        <p className="text-base text-gray-500">No featured work yet.</p>
      </div>
    );
  }

  const displayTitle = artwork.pieceTitle ?? artwork.title;

  return (
    <div className="fixed inset-0 z-[100] bg-white">
      <Link to={`/work/${artwork._id}`} className="block w-full h-full">
        {artwork.imageUrl ? (
          <img
            src={artwork.imageUrl}
            alt={displayTitle}
            className="w-full h-full object-cover block"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
            No image
          </div>
        )}
      </Link>
    </div>
  );
}
