import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";

export function ArtistDetail() {
  const { id } = useParams<{ id: string }>();
  const artistId = id as Id<"artists">;
  const artist = useQuery(api.artists.getById, { id: artistId });
  const artworks = useQuery(api.artworks.getByArtist, { artistId });
  const updates = useQuery(api.artistUpdates.listByArtist, { artistId, limit: 7 });

  if (!artist) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-12">
        <div className="lg:col-span-1">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-6">
            {artist.profileImageUrl ? (
              <img
                src={artist.profileImageUrl}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto mb-4"></div>
                  <p>No Photo</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {artist.website && (
              <a
                href={artist.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:text-blue-800 transition-colors"
              >
                Website
              </a>
            )}
            {artist.instagram && (
              <a
                href={`https://instagram.com/${artist.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:text-blue-800 transition-colors"
              >
                @{artist.instagram}
              </a>
            )}
            {artist.email && (
              <a
                href={`mailto:${artist.email}`}
                className="block text-blue-600 hover:text-blue-800 transition-colors"
              >
                {artist.email}
              </a>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h1 className="text-4xl font-bold text-black mb-6">{artist.name}</h1>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 leading-relaxed">{artist.bio}</p>
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-black mb-4">Evolution Log</h2>
            {!updates ? (
              <p className="text-gray-500">Loading daily evolution...</p>
            ) : updates.length === 0 ? (
              <p className="text-gray-500">No daily evolution notes yet.</p>
            ) : (
              <div className="space-y-4">
                {updates.map((u) => (
                  <div key={u._id} className="rounded-lg border border-gray-200 p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700">{u.date}</p>
                      {typeof u.score === "number" && (
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">Score {u.score}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{u.summary}</p>
                    {u.interests?.length ? (
                      <p className="text-xs text-gray-500 mb-1">
                        <span className="font-medium">Interests:</span> {u.interests.join(", ")}
                      </p>
                    ) : null}
                    {u.inspiration?.length ? (
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">Inspiration:</span> {u.inspiration.join(" • ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-black mb-8">Artworks</h2>
        {!artworks || artworks.length === 0 ? (
          <p className="text-gray-500">No artworks available.</p>
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
                <p className="text-sm text-gray-500">{artwork.year}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
