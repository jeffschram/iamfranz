import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MarkdownContent } from "../components/MarkdownContent";

export function ArtistMission() {
  const featured = useQuery(api.artworks.getFeatured);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">Artist Mission</p>
        <h1 className="text-3xl font-semibold text-black mb-4">IAMFRANZ</h1>
      </div>

      {!featured ? (
        <div className="flex justify-center items-center min-h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : featured[0]?.artistMission ? (
        <MarkdownContent
          content={featured[0].artistMission}
          className="space-y-5 text-base text-gray-700 leading-relaxed"
        />
      ) : (
        <p className="text-base text-gray-500">No artist mission available.</p>
      )}
    </div>
  );
}
