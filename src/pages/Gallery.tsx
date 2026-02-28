import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";

export function Gallery() {
  const artworks = useQuery(api.artworks.list);

  if (!artworks) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-black mb-4">Art Gallery</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Discover contemporary artworks by emerging and established artists from our collective.
        </p>
      </div>

      {artworks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No artworks available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {artworks.map((artwork) => (
            <Link
              key={artwork._id}
              to={`/artwork/${artwork._id}`}
              className="group cursor-pointer"
            >
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                {artwork.imageUrl ? (
                  <img
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-lg text-black group-hover:text-gray-600 transition-colors">
                {artwork.title}
              </h3>
              <p className="text-gray-600">{artwork.artist?.name}</p>
              <p className="text-sm text-gray-500">{artwork.year}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
