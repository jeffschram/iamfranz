import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";

export function Artists() {
  const artists = useQuery(api.artists.list);

  if (!artists) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-black mb-4">Our Artists</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Meet the talented artists who make up the IAMFRANZ collective.
        </p>
      </div>

      {artists.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No artists available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {artists.map((artist) => (
            <Link
              key={artist._id}
              to={`/artist/${artist._id}`}
              className="group cursor-pointer"
            >
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                {artist.profileImageUrl ? (
                  <img
                    src={artist.profileImageUrl}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-2"></div>
                      <p className="text-sm">No Photo</p>
                    </div>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-lg text-black group-hover:text-gray-600 transition-colors">
                {artist.name}
              </h3>
              <p className="text-gray-600 text-sm line-clamp-2">{artist.bio}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
