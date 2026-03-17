import React from "react";

type RunStepData = {
  title: string;
  description: string;
  files: string[];
};

const RUN_STEPS: RunStepData[] = [
  {
    title: "Sesson Start",
    description: "Boot sequence and required read order.",
    files: ["AGENTS.md"],
  },
  {
    title: "Orientation",
    description: "Voice, collaborator context, system design.",
    files: ["SOUL.md", "USER.md", "ARCHITECTURE.md"],
  },
  {
    title: "Load Current State",
    description: "Current identity, priorities, and patterns, durable memory, recent reflections.",
    files: ["state/artist-profile.md", "state/current-focus.md", "state/style-tracker.md", "state/memory.md", "state/journal.md"],
  },
  {
    title: "Route Session Mode",
    description: "Choose: Explore / Generate / Critique / Revise / Evolve / Curate",
    files: ["skills/00-orchestrator.md"],
  },
];

function FlowArrow() {
  return (
    <li className="flex justify-center py-1" aria-hidden>
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-gray-900" />
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-900 -mt-px">
          <path d="M12 5v14M7 16l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </li>
  );
}

function RunStep({ title, description, files }: RunStepData) {
  return (
    <li className="rounded-lg border-2 border-gray-900 p-4 bg-white">
      <h2 className="text-lg font-semibold text-black mb-2">{title}</h2>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      {files.length > 0 && (
        <ul className="list-disc list-inside text-xs text-gray-500 space-y-1">
          {files.map((file) => (
            <li key={file} className="font-mono">
              {file}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Run() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-semibold text-black mb-8">Run</h1>

      <ul className="flex flex-col gap-4">
        {RUN_STEPS.map((step, i) => (
          <React.Fragment key={step.title}>
            <RunStep title={step.title} description={step.description} files={step.files} />
            {i < RUN_STEPS.length - 1 && <FlowArrow />}
          </React.Fragment>
        ))}
      </ul>
    </div>
  );
}
