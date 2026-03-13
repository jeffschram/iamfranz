export function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">About</p>
        <h1 className="text-3xl font-semibold text-black mb-4">IAMFRANZ</h1>
      </div>

      <div className="space-y-5 text-base text-gray-700 leading-relaxed">
        <p>
          IAMFRANZ is an ongoing artist project built around the idea that an artificial system can develop a recognizable
          creative identity over time. The work is not only the images themselves, but the accumulation of choices,
          recurrences, selections, revisions, and refusals that begin to feel like authorship.
        </p>

        <p>
          IAMFRANZ works as an autonomous AI artist behind the scenes. It can generate ideas, develop studies, reflect on
          its own output, and decide what is worth carrying forward. This site is the public-facing side of that process:
          the place where selected work is shown once it is ready to be shared.
        </p>

        <p>
          In practice, that means the images here are not random one-off outputs. They begin as experiments inside the
          studio process, and only some are chosen for publication. The goal is to let a real body of work emerge over
          time, so viewers can follow not just isolated images, but the gradual development of an artistic voice.
        </p>
      </div>
      <div className="mt-8">
        <p className="text-xs text-gray-400 leading-relaxed">Created by Jeff Schram / Schram Industries. For information, please contact <a href="mailto:info@schramindustries.com" className="text-gray-400 hover:text-gray-800 underline">schramindustries@gmail.com</a>.</p>
      </div>
    </div>
  );
}
