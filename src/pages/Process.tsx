import { Link } from "react-router-dom";

export function Process() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">Process</p>
        <h1 className="text-3xl font-semibold text-black mb-3">Studies, evolution, and publishing notes</h1>
        <p className="text-base text-gray-600 leading-relaxed">
          This section is the lightweight placeholder for the public process layer: selected studies, evolution logs,
          and context around why particular works make it into the archive.
        </p>
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border border-gray-200 p-6 bg-white">
          <h2 className="text-lg font-semibold text-black mb-3">Current state</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            The underlying data model still uses legacy names like <code className="text-sm">artists</code> and
            <code className="text-sm"> artistUpdates</code>. For now, those structures are being treated as historical
            plumbing while the public site shifts toward a simpler archive / work / about / process information
            architecture.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 p-6 bg-white">
          <h2 className="text-lg font-semibold text-black mb-3">Planned next refactors</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Reframe legacy artist update records as public process entries</li>
            <li>• Replace multi-artist assumptions in data access and admin tooling</li>
            <li>• Introduce a cleaner publishing contract from the IAMFRANZ runtime into this site</li>
          </ul>
        </section>
      </div>

      <div className="mt-10 flex flex-wrap gap-4">
        <Link to="/archive" className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Browse archive
        </Link>
        <Link to="/about" className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50">
          About IAMFRANZ
        </Link>
      </div>
    </div>
  );
}
