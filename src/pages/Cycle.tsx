import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";

type CyclePhase = "intro" | "image" | "detail" | "black";

type CycleArtwork = {
  _id: string;
  _creationTime: number;
  sortOrder?: number | null;
  title: string;
  pieceTitle?: string | null;
  description: string;
  statement?: string | null;
  imageUrl?: string | null;
};

const PHASE_DURATION_MS: Record<CyclePhase, number> = {
  intro: 6_000,
  image: 10_000,
  detail: 22_000,
  black: 5_000,
};

const BLACK_SWAP_DELAY_MS = 2_400;

function parseStartNumber(value: string | null): number {
  if (!value) return 1;
  if (!/^\d+$/.test(value)) return 1;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;

  return parsed;
}

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

function nextPhase(phase: CyclePhase): CyclePhase {
  if (phase === "intro") return "image";
  if (phase === "image") return "detail";
  if (phase === "detail") return "black";
  return "intro";
}

function cycleTextParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .map((paragraph) => paragraph.replace(/^#+\s+/, ""))
    .filter(Boolean);
}

export function Cycle() {
  const [searchParams] = useSearchParams();
  const requestedStartNumber = parseStartNumber(searchParams.get("num"));
  const [currentSortOrder, setCurrentSortOrder] = useState<
    number | undefined
  >();
  const cycleWindow = useQuery(api.artworks.getCycleWindow, {
    currentSortOrder,
  });
  const [currentArtwork, setCurrentArtwork] = useState<CycleArtwork | null>(
    null,
  );
  const [nextArtwork, setNextArtwork] = useState<CycleArtwork | null>(null);
  const [nextWrapped, setNextWrapped] = useState(false);
  const [artworkNumber, setArtworkNumber] = useState(1);
  const [seekNumber, setSeekNumber] = useState(1);
  const [targetStartNumber, setTargetStartNumber] =
    useState(requestedStartNumber);
  const [isSeekingStart, setIsSeekingStart] = useState(
    requestedStartNumber > 1,
  );
  const [phase, setPhase] = useState<CyclePhase>("intro");
  const [isBlackSwapComplete, setIsBlackSwapComplete] = useState(false);
  const latestCycleState = useRef({
    artworkNumber,
    nextArtwork,
    nextWrapped,
  });

  useEffect(() => {
    latestCycleState.current = {
      artworkNumber,
      nextArtwork,
      nextWrapped,
    };
  }, [artworkNumber, nextArtwork, nextWrapped]);

  useEffect(() => {
    setCurrentSortOrder(undefined);
    setCurrentArtwork(null);
    setNextArtwork(null);
    setNextWrapped(false);
    setArtworkNumber(1);
    setSeekNumber(1);
    setTargetStartNumber(requestedStartNumber);
    setIsSeekingStart(requestedStartNumber > 1);
    setPhase("intro");
    setIsBlackSwapComplete(false);
  }, [requestedStartNumber]);

  useEffect(() => {
    if (!cycleWindow?.current || currentArtwork) return;

    if (isSeekingStart && seekNumber < targetStartNumber) {
      if (cycleWindow.nextWrapped) {
        const normalizedStartNumber =
          ((targetStartNumber - 1) % seekNumber) + 1;

        if (normalizedStartNumber === seekNumber) {
          setCurrentArtwork(cycleWindow.current);
          setNextArtwork(cycleWindow.next);
          setNextWrapped(cycleWindow.nextWrapped);
          setArtworkNumber(seekNumber);
          setIsSeekingStart(false);
          return;
        }

        if (normalizedStartNumber === 1) {
          const firstArtwork = cycleWindow.next ?? cycleWindow.current;

          setCurrentArtwork(firstArtwork);
          setNextArtwork(null);
          setNextWrapped(false);
          setArtworkNumber(1);
          setIsSeekingStart(false);

          if (typeof firstArtwork.sortOrder === "number") {
            setCurrentSortOrder(firstArtwork.sortOrder);
          }
          return;
        }

        setTargetStartNumber(normalizedStartNumber);
        setSeekNumber(1);
        setCurrentSortOrder(undefined);
        return;
      }

      if (typeof cycleWindow.next?.sortOrder === "number") {
        setSeekNumber((value) => value + 1);
        setCurrentSortOrder(cycleWindow.next.sortOrder);
        return;
      }
    }

    setCurrentArtwork(cycleWindow.current);
    setNextArtwork(cycleWindow.next);
    setNextWrapped(cycleWindow.nextWrapped);
    setArtworkNumber(seekNumber);
    setIsSeekingStart(false);
  }, [
    cycleWindow,
    currentArtwork,
    isSeekingStart,
    seekNumber,
    targetStartNumber,
  ]);

  useEffect(() => {
    if (!cycleWindow?.current || !currentArtwork) return;
    if (cycleWindow.current._id !== currentArtwork._id) return;

    setNextArtwork(cycleWindow.next);
    setNextWrapped(cycleWindow.nextWrapped);
  }, [cycleWindow, currentArtwork]);

  useEffect(() => {
    if (!nextArtwork?.imageUrl) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
    };
    image.src = nextArtwork.imageUrl;

    return () => {
      cancelled = true;
    };
  }, [nextArtwork?.imageUrl]);

  useEffect(() => {
    if (!currentArtwork || phase === "black") return;

    const timer = window.setTimeout(() => {
      setPhase(nextPhase(phase));
    }, PHASE_DURATION_MS[phase]);

    return () => window.clearTimeout(timer);
  }, [currentArtwork, phase]);

  useEffect(() => {
    if (phase !== "black") return;

    setIsBlackSwapComplete(false);

    const swapTimer = window.setTimeout(() => {
      const {
        artworkNumber: latestNumber,
        nextArtwork: next,
        nextWrapped: wrapped,
      } = latestCycleState.current;
      if (!next) return;

      setCurrentArtwork(next);
      setArtworkNumber(wrapped ? 1 : latestNumber + 1);
      setIsBlackSwapComplete(true);

      if (typeof next.sortOrder === "number") {
        setCurrentSortOrder(next.sortOrder);
      }
    }, BLACK_SWAP_DELAY_MS);

    const phaseTimer = window.setTimeout(() => {
      setPhase("intro");
    }, PHASE_DURATION_MS.black);

    return () => {
      window.clearTimeout(swapTimer);
      window.clearTimeout(phaseTimer);
    };
  }, [phase]);

  if (!currentArtwork) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  const displayTitle = currentArtwork.pieceTitle ?? currentArtwork.title;
  const displayDate = extractDisplayDate(currentArtwork.title);
  const detailText =
    currentArtwork.statement?.trim() || currentArtwork.description;
  const paragraphs = cycleTextParagraphs(detailText);
  const isFullscreen = phase === "intro" || phase === "image";
  const isDetail = phase === "detail";
  const isBlack = phase === "black";
  const isHiddenFullscreen = isBlack && isBlackSwapComplete;
  const isHiddenDetail = isBlack && !isBlackSwapComplete;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black text-black">
      {currentArtwork.imageUrl && (
        <img
          src={currentArtwork.imageUrl}
          alt={displayTitle}
          className={[
            "absolute transition-all duration-[1800ms] ease-in-out",
            isFullscreen
              ? "inset-0 h-full w-full object-cover opacity-100"
              : "",
            isHiddenFullscreen
              ? "inset-0 h-full w-full object-cover opacity-0"
              : "",
            isDetail
              ? "left-1/2 top-[26vh] h-[36vh] w-[82vw] -translate-x-1/2 -translate-y-1/2 object-contain opacity-100 md:left-[6vw] md:top-1/2 md:h-[58vh] md:w-[44vw] md:translate-x-0"
              : "",
            isHiddenDetail
              ? "left-1/2 top-[26vh] h-[36vh] w-[82vw] -translate-x-1/2 -translate-y-1/2 object-contain opacity-0 md:left-[6vw] md:top-1/2 md:h-[58vh] md:w-[44vw] md:translate-x-0"
              : "",
          ].join(" ")}
        />
      )}

      <div
        className={[
          "absolute left-1/2 bottom-[8vh] w-[min(560px,calc(100vw-48px))] -translate-x-1/2 bg-white px-8 py-5 text-center shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition-opacity duration-1000",
          phase === "intro" ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <h1 className="text-xl font-semibold leading-tight text-black sm:text-2xl">
          {displayTitle}
        </h1>
        {displayDate && (
          <p className="mt-2 text-xs text-gray-400">{displayDate}</p>
        )}
      </div>

      <section
        className={[
          "absolute left-1/2 top-[68vh] max-h-[42vh] w-[82vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-white px-6 py-6 transition-opacity duration-[1400ms] md:left-auto md:right-[8vw] md:top-1/2 md:max-h-[68vh] md:w-[min(420px,34vw)] md:translate-x-0 md:px-8 md:py-8",
          isDetail ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="space-y-4 text-[13px] leading-relaxed text-black">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
