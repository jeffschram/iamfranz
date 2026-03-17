import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import { MarkdownContent } from "../components/MarkdownContent";
import { isLocalhost, showOnLocalhost } from "../lib/utils";

function CopyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy field", error);
    }
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h4>
        <button
          type="button"
          onClick={copyValue}
          className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-black hover:text-black"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {multiline ? (
        <textarea
          readOnly
          value={value}
          className="min-h-[120px] w-full resize-y bg-transparent px-3 py-3 text-sm leading-relaxed text-gray-700 outline-none"
        />
      ) : (
        <div className="px-3 py-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap break-words">{value}</div>
      )}
    </div>
  );
}

function LocalhostOnly({ children }: { children: ReactNode }) {
  return showOnLocalhost(children, null);
}

function CopyAllButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy full post", error);
    }
  };

  return (
    <button
      type="button"
      onClick={copyValue}
      className="rounded border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 transition hover:border-sky-500 hover:bg-sky-100"
    >
      {copied ? "Copied all" : "Copy all"}
    </button>
  );
}

export function ArtworkDetail() {
  const { id } = useParams<{ id: string }>();
  const artwork = useQuery(api.artworks.getById, { id: id as Id<"artworks"> });

  const socialPostingMetadata = useMemo(() => {
    if (!artwork?.socialPostingMetadata) return null;
    try {
      return JSON.parse(artwork.socialPostingMetadata) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [artwork?.socialPostingMetadata]);

  const hashtagLine = useMemo(() => (artwork?.socialHashtags ?? []).join(" "), [artwork?.socialHashtags]);
  const fullInstagramPost = useMemo(() => {
    if (!artwork?.socialCaption) return "";
    return [artwork.socialCaption, hashtagLine].filter(Boolean).join("\n\n");
  }, [artwork?.socialCaption, hashtagLine]);

  if (!artwork) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  const showLocalSocialTools = isLocalhost() && (artwork.socialCaption || artwork.socialAltText || (artwork.socialHashtags?.length ?? 0) > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="lg:sticky lg:top-24">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {artwork.imageUrl ? (
              <img
                src={artwork.imageUrl}
                alt={artwork.pieceTitle ?? artwork.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-black mb-1.5">{artwork.pieceTitle ?? artwork.title}</h1>
            <Link to="/about" className="text-gray-600 hover:text-black transition-colors">
              IAMFRANZ
            </Link>
            {artwork.artistId && artwork.artist?.name && artwork.artist.name !== "IAMFRANZ" ? (
              <Link
                to={`/artist/${artwork.artistId}`}
                className="inline-flex mt-2 text-sm text-amber-700 hover:text-amber-900 transition-colors"
              >
                Legacy source profile: {artwork.artist.name}
              </Link>
            ) : null}
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-black mb-2">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{artwork.description}</p>
            </div>

            <LocalhostOnly>
              {showLocalSocialTools ? (
                <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-sky-900">Local posting tools</h3>
                      <p className="mt-1 text-xs text-sky-800">
                        Only visible on localhost. Copy-paste ammo for Instagram, because manually reassembling captions like a caveperson is beneath us.
                      </p>
                    </div>
                    {fullInstagramPost ? <CopyAllButton value={fullInstagramPost} /> : null}
                  </div>

                  {fullInstagramPost ? <CopyField label="Full caption + hashtags" value={fullInstagramPost} multiline /> : null}
                  {artwork.socialCaption ? <CopyField label="Caption" value={artwork.socialCaption} multiline /> : null}
                  {hashtagLine ? <CopyField label="Hashtags" value={hashtagLine} multiline /> : null}
                  {artwork.socialAltText ? <CopyField label="Alt text" value={artwork.socialAltText} multiline /> : null}
                  {socialPostingMetadata ? (
                    <CopyField
                      label="Posting metadata"
                      value={JSON.stringify(socialPostingMetadata, null, 2)}
                      multiline
                    />
                  ) : null}
                </div>
              ) : null}
            </LocalhostOnly>

            {(artwork.artistThinking || artwork.inspirationNote) && (
              <div className="space-y-3 space-x-top-3">
                {artwork.artistThinking && (
                  <MarkdownContent content={artwork.artistThinking} className="space-y-3 text-sm " stripFirstH1 />
                )}
                {artwork.inspirationNote && (
                  <p className="text-sm text-gray-600 leading-relaxed"><span className="font-medium text-gray-700">Inspiration:</span> {artwork.inspirationNote}</p>
                )}
              </div>
            )}

            {(artwork.researchSourceTitle || artwork.researchSourceUrl || artwork.learningTechnique || artwork.learningConcept || artwork.learningVisual) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-black mb-1">Research & Learnings</h3>
                {(artwork.researchSourceTitle || artwork.researchSourceUrl) && (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-medium">Source:</span>{" "}
                    {artwork.researchSourceUrl ? (
                      <a href={artwork.researchSourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                        {artwork.researchSourceTitle ?? artwork.researchSourceUrl}
                      </a>
                    ) : (
                      artwork.researchSourceTitle
                    )}
                  </p>
                )}
                {artwork.learningTechnique && (
                  <p className="text-sm text-gray-700 leading-relaxed"><span className="font-medium">Technique:</span> {artwork.learningTechnique}</p>
                )}
                {artwork.learningConcept && (
                  <p className="text-sm text-gray-700 leading-relaxed"><span className="font-medium">Concept:</span> {artwork.learningConcept}</p>
                )}
                {artwork.learningVisual && (
                  <p className="text-sm text-gray-700 leading-relaxed"><span className="font-medium">Visual cue:</span> {artwork.learningVisual}</p>
                )}
              </div>
            )}

            {artwork.prompt && (
              <details className="border border-gray-200 rounded-md bg-gray-50">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-black marker:text-gray-500">
                  Show prompt excerpt
                </summary>
                <div className="px-4 pb-4">
                  <pre className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">
{artwork.prompt}
                  </pre>
                </div>
              </details>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-black">Year</h4>
                <p className="text-sm text-gray-600">{artwork.year}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-black">Medium</h4>
                <p className="text-sm text-gray-600">{artwork.medium}</p>
              </div>
              {artwork.dimensions && (
                <div>
                  <h4 className="text-sm font-medium text-black">Dimensions</h4>
                  <p className="text-sm text-gray-600">{artwork.dimensions}</p>
                </div>
              )}
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
