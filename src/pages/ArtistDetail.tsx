import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";

type ArtistUpdate = {
  _id: string;
  date: string;
  runId: string;
  summary: string;
  score?: number;
  pieceTitle?: string;
  hypothesis?: string;
  experimentOutcome?: string;
  arcName?: string;
  arcStep?: number;
  noveltyDelta?: number;
  coherence?: number;
  risk?: number;
  adoptedRefs?: string[];
  resistedRef?: string;
  constraintBroken?: string;
};

export function ArtistDetail() {
  // Legacy route preserved temporarily while old imported records still reference multi-artist data.
  const { id } = useParams<{ id: string }>();
  const artistId = id as Id<"artists">;
  const artist = useQuery(api.artists.getById, { id: artistId });
  const artworks = useQuery(api.artworks.getByArtist, { artistId });
  const updates = useQuery(api.artistUpdates.listByArtist, { artistId, limit: 18 }) as ArtistUpdate[] | undefined;

  const stats = useMemo(() => {
    if (!updates?.length) return null;
    const scores = updates.map((u) => u.score).filter((n): n is number => typeof n === "number");
    const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
    const latest = updates[0];
    const previous = updates[1];
    const trend = typeof latest?.score === "number" && typeof previous?.score === "number"
      ? latest.score - previous.score
      : null;
    const arc = latest?.arcName ? `${latest.arcName}${latest.arcStep ? ` (${latest.arcStep})` : ""}` : null;
    return { avg, trend, arc, totalRuns: updates.length };
  }, [updates]);

  const artworkByRun = useMemo(() => {
    const map = new Map<string, any>();
    (artworks ?? []).forEach((a: any) => {
      const runId = (a.title?.split(" — ")?.[0] ?? "").trim();
      if (runId) map.set(runId, a);
    });
    return map;
  }, [artworks]);

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
              <img src={artist.profileImageUrl} alt={artist.name} className="w-full h-full object-cover" />
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
              <a href={artist.website} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:text-blue-800 transition-colors">Website</a>
            )}
            {artist.instagram && (
              <a href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:text-blue-800 transition-colors">@{artist.instagram}</a>
            )}
            {artist.email && (
              <a href={`mailto:${artist.email}`} className="block text-blue-600 hover:text-blue-800 transition-colors">{artist.email}</a>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-4 inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            Legacy profile from the retired three-artist system
          </div>
          <h1 className="text-4xl font-bold text-black mb-4">{artist.name}</h1>
          <p className="text-gray-600 leading-relaxed">{artist.bio}</p>
          <p className="text-sm text-gray-500 mt-3">
            The public site is being repurposed around IAMFRANZ as a single artist identity. This page remains available for historical context during the transition.
          </p>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <p className="text-xs text-gray-500">Runs tracked</p>
                <p className="text-xl font-semibold text-black">{stats.totalRuns}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <p className="text-xs text-gray-500">Avg score</p>
                <p className="text-xl font-semibold text-black">{stats.avg ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <p className="text-xs text-gray-500">Latest trend</p>
                <p className={`text-xl font-semibold ${typeof stats.trend === "number" ? (stats.trend >= 0 ? "text-green-600" : "text-red-600") : "text-black"}`}>
                  {typeof stats.trend === "number" ? `${stats.trend >= 0 ? "+" : ""}${stats.trend}` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-white">
                <p className="text-xs text-gray-500">Current arc</p>
                <p className="text-sm font-semibold text-black">{stats.arc ?? "—"}</p>
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-black mb-4">Evolution Timeline</h2>
            {!updates ? (
              <p className="text-gray-500">Loading evolution data...</p>
            ) : updates.length === 0 ? (
              <p className="text-gray-500">No evolution entries yet.</p>
            ) : (
              <div className="space-y-4">
                {updates.map((u) => {
                  const artwork = artworkByRun.get(u.runId);
                  return (
                    <div key={u._id} className="rounded-lg border border-gray-200 p-4 bg-white">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-gray-700">{u.date}</span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">Run {u.runId}</span>
                        {typeof u.score === "number" && <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">Score {u.score}</span>}
                        {u.arcName && <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">{u.arcName}{u.arcStep ? ` • step ${u.arcStep}` : ""}</span>}
                        {typeof u.noveltyDelta === "number" && (
                          <span className={`text-xs px-2 py-1 rounded ${u.noveltyDelta >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            Δ {u.noveltyDelta >= 0 ? "+" : ""}{u.noveltyDelta}
                          </span>
                        )}
                      </div>

                      {u.pieceTitle && <p className="text-base font-semibold text-black mb-1">{u.pieceTitle}</p>}
                      <p className="text-sm text-gray-700 mb-3">{u.summary}</p>

                      {u.hypothesis && (
                        <p className="text-xs text-gray-600 mb-2"><span className="font-medium text-gray-700">Hypothesis:</span> {u.hypothesis}</p>
                      )}
                      {u.experimentOutcome && (
                        <p className="text-xs text-gray-600 mb-2"><span className="font-medium text-gray-700">Outcome:</span> {u.experimentOutcome}</p>
                      )}

                      {(u.adoptedRefs?.length || u.resistedRef || u.constraintBroken) && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {u.adoptedRefs?.map((r) => (
                            <span key={r} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700">Adopted: {r}</span>
                          ))}
                          {u.resistedRef && <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700">Resisted: {u.resistedRef}</span>}
                          {u.constraintBroken && <span className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700">Broke: {u.constraintBroken}</span>}
                        </div>
                      )}

                      {(typeof u.coherence === "number" || typeof u.risk === "number") && (
                        <p className="text-xs text-gray-500 mb-2">
                          {typeof u.coherence === "number" ? `Coherence ${u.coherence}` : ""}
                          {typeof u.coherence === "number" && typeof u.risk === "number" ? " • " : ""}
                          {typeof u.risk === "number" ? `Risk ${u.risk.toFixed(2)}` : ""}
                        </p>
                      )}

                      {artwork && (
                        <Link to={`/artwork/${artwork._id}`} className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800">
                          View artwork: {artwork.pieceTitle ?? artwork.title}
                        </Link>
                      )}
                    </div>
                  );
                })}
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
            {artworks.map((artwork: any) => (
              <Link key={artwork._id} to={`/artwork/${artwork._id}`} className="group cursor-pointer">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                  {artwork.imageUrl ? (
                    <img src={artwork.imageUrl} alt={artwork.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                  )}
                </div>
                <h3 className="font-semibold text-lg text-black group-hover:text-gray-600 transition-colors">
                  {artwork.pieceTitle ?? artwork.title}
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
