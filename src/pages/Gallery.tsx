import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";

type Artwork = {
  _id: string;
  title: string;
  pieceTitle?: string | null;
  imageUrl?: string | null;
  artist?: { name?: string | null } | null;
  year?: number;
};

type RunSection = {
  runId: string;
  label: string;
  sortTs: number;
  artworks: Artwork[];
};

function parseRunIdFromTitle(title: string): string {
  const parts = title.split(" — ");
  if (!parts.length) return "legacy";
  const candidate = parts[0]?.trim() ?? "legacy";

  // New format: YYYY-MM-DD_HH-mm-ss
  if (/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  // Older date-only format
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;

  return "legacy";
}

function runIdToLabel(runId: string): { label: string; sortTs: number } {
  const dtMatch = runId.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (dtMatch) {
    const [, y, m, d, hh, mm, ss] = dtMatch;
    const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
    const date = new Date(iso);
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);
    return { label, sortTs: date.getTime() };
  }

  const dayMatch = runId.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayMatch) {
    const [, y, m, d] = dayMatch;
    const date = new Date(`${y}-${m}-${d}T00:00:00`);
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
    return { label, sortTs: date.getTime() };
  }

  return { label: "Legacy / Misc", sortTs: 0 };
}

function groupArtworksByRun(artworks: Artwork[]): RunSection[] {
  const map = new Map<string, RunSection>();

  for (const artwork of artworks) {
    const runId = parseRunIdFromTitle(artwork.title ?? "");
    if (!map.has(runId)) {
      const meta = runIdToLabel(runId);
      map.set(runId, {
        runId,
        label: meta.label,
        sortTs: meta.sortTs,
        artworks: [],
      });
    }
    map.get(runId)!.artworks.push(artwork);
  }

  return [...map.values()]
    .sort((a, b) => b.sortTs - a.sortTs)
    .map((section) => ({
      ...section,
      artworks: section.artworks.sort((a, b) => (a.artist?.name ?? "").localeCompare(b.artist?.name ?? "")),
    }));
}

export function Gallery() {
  const artworks = useQuery(api.artworks.list);

  if (!artworks) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  const sections = groupArtworksByRun(artworks as Artwork[]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-black mb-4">Art Gallery</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Autonomous runs, grouped by timestamp. Each section captures one run snapshot.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No artworks available yet.</p>
        </div>
      ) : (
        <div className="space-y-14">
          {sections.map((section) => (
            <section key={section.runId} className="space-y-6">
              <div className="border-b border-gray-200 pb-3">
                <h2 className="text-2xl font-semibold text-black">{section.label}</h2>
                <p className="text-sm text-gray-500 mt-1">Run ID: {section.runId}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {section.artworks.map((artwork) => (
                  <Link key={artwork._id} to={`/artwork/${artwork._id}`} className="group cursor-pointer">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                      {artwork.imageUrl ? (
                        <img
                          src={artwork.imageUrl}
                          alt={artwork.pieceTitle ?? artwork.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg text-black group-hover:text-gray-600 transition-colors">
                      {artwork.artist?.name ?? "Unknown Artist"}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{artwork.pieceTitle ?? artwork.title}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
