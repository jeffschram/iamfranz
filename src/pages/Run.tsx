import React, { useMemo, useState } from "react";
import runRecordsData from "@/data/iamfranz-process-runs.json";

type RunFileChange = {
  path: string;
  kind: "read" | "created" | "updated" | "selected" | "generated" | "exported" | "imported";
  note?: string;
  absolutePath?: string | null;
  inlineContent?: string | null;
  inlineContentType?: "text" | null;
};

type RunArtifact = {
  label: string;
  path: string;
  kind: "image" | "markdown" | "json" | "text" | "external";
  note?: string;
  previewUrl?: string;
  status?: "published" | "selected" | "parked" | "rejected" | "draft";
};

type RunDecision = {
  label: string;
  value: string;
  note?: string;
};

type RunStepRecord = {
  id: string;
  title: string;
  description: string;
  status: "completed" | "active" | "pending" | "skipped";
  mode?: "Explore" | "Generate" | "Critique" | "Revise" | "Evolve" | "Curate";
  files: RunFileChange[];
  artifacts?: RunArtifact[];
  outputs?: string[];
  summary?: string;
  changed?: string[];
  decision?: RunDecision;
};

type RunRecord = {
  schemaVersion?: number;
  runId: string;
  agent: string;
  startedAt?: string;
  completedAt?: string;
  status: "completed" | "running" | "failed";
  mode: "Explore" | "Generate" | "Critique" | "Revise" | "Evolve" | "Curate";
  bundleSlug?: string;
  pieceTitle?: string;
  title?: string;
  overview: string;
  imageUrl?: string | null;
  steps: RunStepRecord[];
};

type RunRecordLibrary = {
  schemaVersion?: number;
  syncedAt?: string;
  runs: RunRecord[];
};

const RUN_LIBRARY = runRecordsData as RunRecordLibrary;

function FlowArrow() {
  return (
    <li className="flex justify-center py-1" aria-hidden>
      <div className="flex flex-col items-center">
        <div className="h-4 w-0.5 bg-gray-900" />
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="-mt-px text-gray-900">
          <path d="M12 5v14M7 16l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: RunStepRecord["status"] | "failed" | "running" }) {
  const styles = {
    completed: "bg-black text-white border-black",
    active: "bg-yellow-100 text-yellow-900 border-yellow-300",
    pending: "bg-gray-100 text-gray-700 border-gray-300",
    skipped: "bg-white text-gray-500 border-gray-300",
    failed: "bg-red-100 text-red-800 border-red-300",
    running: "bg-yellow-100 text-yellow-900 border-yellow-300",
  } as const;

  const normalized = status === "running" ? "active" : status;
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${styles[normalized]}`}>{status}</span>;
}

function FileKindBadge({ kind }: { kind: RunFileChange["kind"] }) {
  return <span className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gray-600">{kind}</span>;
}

function ArtifactStatusBadge({ status }: { status?: RunArtifact["status"] }) {
  if (!status) return null;
  const styles = {
    published: "bg-black text-white border-black",
    selected: "bg-blue-100 text-blue-800 border-blue-300",
    parked: "bg-amber-100 text-amber-800 border-amber-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
    draft: "bg-gray-100 text-gray-700 border-gray-300",
  } as const;

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${styles[status]}`}>{status}</span>;
}

function findPrimaryImage(step: RunStepRecord, run: RunRecord) {
  const artifactImage = step.artifacts?.find((artifact) => artifact.kind === "image" && artifact.previewUrl)?.previewUrl;
  return artifactImage ?? run.imageUrl ?? null;
}

function FileContentModal({ file, onClose }: { file: RunFileChange; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border-2 border-black bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">File contents</p>
            <h3 className="mt-1 font-mono text-sm text-black">{file.path}</h3>
            {file.absolutePath && <p className="mt-1 text-xs text-gray-500">{file.absolutePath}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-black hover:text-black">Close</button>
        </div>
        <div className="max-h-[calc(85vh-84px)] overflow-auto px-5 py-4">
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-gray-950 p-4 font-mono text-xs leading-6 text-gray-100">{file.inlineContent ?? "No inline content available."}</pre>
        </div>
      </div>
    </div>
  );
}

function ArtifactGallery({ artifacts }: { artifacts: RunArtifact[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Artifacts</h3>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {artifacts.map((artifact) => (
          <li key={artifact.path} className="overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
            {artifact.previewUrl && (
              <div className="border-b border-gray-200 bg-gray-50">
                <img src={artifact.previewUrl} alt={artifact.label} className="aspect-square w-full object-cover" />
              </div>
            )}
            <div className="p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-black">{artifact.label}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gray-600">{artifact.kind}</span>
                <ArtifactStatusBadge status={artifact.status} />
              </div>
              <p className="font-mono text-xs text-gray-600">{artifact.path}</p>
              {artifact.note && <p className="mt-2 text-xs text-gray-500">{artifact.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunStep({ step, run, onViewFile }: { step: RunStepRecord; run: RunRecord; onViewFile: (file: RunFileChange) => void }) {
  const imageUrl = findPrimaryImage(step, run);

  return (
    <li className="rounded-lg border-2 border-gray-900 bg-white">
      <details>
        <summary className="cursor-pointer list-none p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
            <div>
              <h2 className="text-lg font-semibold text-black">{step.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{step.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {step.mode && <span className="inline-flex rounded-full border border-gray-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-700">{step.mode}</span>}
              <StatusBadge status={step.status} />
            </div>
          </div>
        </summary>

        <div className="border-t border-gray-200 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {step.summary && <p className="mb-4 text-sm text-black">{step.summary}</p>}

          {imageUrl && (
            <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <img src={imageUrl} alt={run.pieceTitle || run.title || "IAMFRANZ artwork"} className="aspect-square w-full object-cover" />
            </div>
          )}

          <div className="space-y-4">
            {step.decision && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{step.decision.label}</p>
                <p className="mt-1 text-sm font-semibold text-blue-950">{step.decision.value}</p>
                {step.decision.note && <p className="mt-1 text-sm text-blue-900/80">{step.decision.note}</p>}
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Files touched</h3>
              <ul className="space-y-2">
                {step.files.map((file) => {
                  const canViewInline = Boolean(file.inlineContent);
                  return (
                    <li key={`${step.id}-${file.path}-${file.kind}`} className="rounded border border-gray-200 bg-gray-50 p-2.5">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileKindBadge kind={file.kind} />
                          <span className="font-mono text-xs text-gray-900">{file.path}</span>
                        </div>
                        {canViewInline && (
                          <button type="button" onClick={() => onViewFile(file)} className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:border-black hover:text-black">View file</button>
                        )}
                      </div>
                      {file.note && <p className="text-xs text-gray-600">{file.note}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>

            {step.changed && step.changed.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">What changed</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {step.changed.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}

            {step.outputs && step.outputs.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Outputs</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {step.outputs.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}

            {step.artifacts && step.artifacts.length > 0 && <ArtifactGallery artifacts={step.artifacts} />}
          </div>
        </div>
      </details>
    </li>
  );
}

function RunSummary({ run, runCount }: { run: RunRecord; runCount: number }) {
  const completedSteps = run.steps.filter((step) => step.status === "completed").length;
  const totalArtifacts = run.steps.reduce((sum, step) => sum + (step.artifacts?.length ?? 0), 0);

  return (
    <section className="mb-8 rounded-xl border-2 border-gray-900 bg-white p-5 sm:p-6">
      <div className="mb-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Run Record</p>
            <span className="rounded bg-gray-100 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-gray-600">{runCount} synced runs</span>
          </div>
          <h1 className="text-3xl font-semibold text-black">{run.title ?? run.pieceTitle ?? run.runId}</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">{run.overview}</p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-start lg:justify-end"><StatusBadge status={run.status} /></div>
          {run.imageUrl && <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"><img src={run.imageUrl} alt={run.pieceTitle ?? run.title ?? "IAMFRANZ artwork"} className="aspect-square w-full object-cover" /></div>}
        </div>
      </div>

      <dl className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <div><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Agent</dt><dd className="mt-1 text-black">{run.agent}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Run ID</dt><dd className="mt-1 font-mono text-xs text-black">{run.runId}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Mode</dt><dd className="mt-1 text-black">{run.mode}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Started</dt><dd className="mt-1 text-black">{run.startedAt ?? "—"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Completed</dt><dd className="mt-1 text-black">{run.completedAt ?? "—"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Steps</dt><dd className="mt-1 text-black">{completedSteps}/{run.steps.length} completed</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Artifacts</dt><dd className="mt-1 text-black">{totalArtifacts}</dd></div>
      </dl>
    </section>
  );
}

function RunBrowser({ runs, activeRunId, onSelectRun }: { runs: RunRecord[]; activeRunId: string; onSelectRun: (runId: string) => void }) {
  return (
    <aside className="rounded-xl border-2 border-gray-900 bg-white p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Run Browser</p>
        <h2 className="mt-1 text-lg font-semibold text-black">Recent runs</h2>
      </div>
      <ul className="space-y-3">
        {runs.map((run) => {
          const isActive = run.runId === activeRunId;
          return (
            <li key={run.runId}>
              <button type="button" onClick={() => onSelectRun(run.runId)} className={`w-full rounded-lg border p-3 text-left transition ${isActive ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black hover:border-black"}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{run.title ?? run.pieceTitle ?? run.runId}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${isActive ? "bg-white/15 text-white" : "bg-gray-100 text-gray-600"}`}>{run.mode}</span>
                </div>
                <p className={`line-clamp-3 text-xs ${isActive ? "text-white/80" : "text-gray-600"}`}>{run.overview}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function Run() {
  const runs = useMemo(() => RUN_LIBRARY.runs ?? [], []);
  const [activeRunId, setActiveRunId] = useState(runs[0]?.runId ?? "");
  const [selectedFile, setSelectedFile] = useState<RunFileChange | null>(null);
  const activeRun = runs.find((run) => run.runId === activeRunId) ?? runs[0];

  if (!activeRun) {
    return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"><div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">No IAMFRANZ run records are available yet.</div></div>;
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <RunBrowser runs={runs} activeRunId={activeRun.runId} onSelectRun={setActiveRunId} />
          <div>
            <RunSummary run={activeRun} runCount={runs.length} />
            <ul className="flex flex-col">
              {activeRun.steps.map((step, i) => (
                <React.Fragment key={step.id}>
                  <RunStep step={step} run={activeRun} onViewFile={setSelectedFile} />
                  {i < activeRun.steps.length - 1 && <FlowArrow />}
                </React.Fragment>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {selectedFile && <FileContentModal file={selectedFile} onClose={() => setSelectedFile(null)} />}
    </>
  );
}

export type { RunArtifact, RunDecision, RunFileChange, RunRecord, RunRecordLibrary, RunStepRecord };
