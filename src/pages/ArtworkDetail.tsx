import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
          {artwork.imageUrl ? (
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">{artwork.title}</h1>
            <Link
              to={`/artist/${artwork.artistId}`}
              className="text-lg text-gray-600 hover:text-black transition-colors"
            >
              {artwork.artist?.name}
            </Link>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-black mb-2">Description</h3>
              <p className="text-gray-600 leading-relaxed">{artwork.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-black">Year</h4>
                <p className="text-gray-600">{artwork.year}</p>
              </div>
              <div>
                <h4 className="font-medium text-black">Medium</h4>
                <p className="text-gray-600">{artwork.medium}</p>
              </div>
              {artwork.dimensions && (
                <div>
                  <h4 className="font-medium text-black">Dimensions</h4>
                  <p className="text-gray-600">{artwork.dimensions}</p>
                </div>
              )}
              <div>
                <h4 className="font-medium text-black">Availability</h4>
                <p className={`font-medium ${artwork.isAvailable ? "text-green-600" : "text-red-600"}`}>
                  {artwork.isAvailable ? "Available" : "Sold"}
                </p>
              </div>
            </div>

            {artwork.price && (
              <div>
                <h4 className="font-medium text-black">Price</h4>
                <p className="text-lg font-semibold text-black">${artwork.price.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
