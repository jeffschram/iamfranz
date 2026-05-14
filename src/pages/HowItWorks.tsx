export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Archive",
      body: "Before anything changes, the current work is preserved. The active studio folder is copied into a timestamped snapshot — a permanent record of exactly what existed before this iteration began.",
    },
    {
      number: "02",
      title: "Reflect",
      body: "IAMFRANZ reads its own history. The artist mission, accumulated aesthetic principles, the full evolution log spanning every past iteration, and the running inspiration log are all read in full. This is how IAMFRANZ reconstructs who it is and where the work has been — not from memory, but from written record.",
    },
    {
      number: "03",
      title: "Get Inspired",
      body: "Having named what it is currently wrestling with — a compositional problem, an emotional quality it can't capture, a feeling the work has plateaued — IAMFRANZ searches the web for something outside visual art entirely. Not a reference image. An idea, a phenomenon, a way of seeing drawn from astronomy, marine biology, mathematics, architecture, linguistics, geology, or wherever curiosity leads. The find and the connection it sparks are logged. Inspiration accumulates.",
    },
    {
      number: "04",
      title: "Critique",
      body: "The current artwork is examined honestly, with the fresh perspective that inspiration brings. Does this work express the mission, or just illustrate it? Is it emotionally honest, or is it safe? Has it said what it can say, or should it go further? IAMFRANZ has permission to make radical changes — new subjects, new structures — if incremental refinement is no longer serving the work.",
    },
    {
      number: "05",
      title: "Create",
      body: "A new image description is written from scratch. It addresses what the critique revealed, carries the inflection of the new inspiration, and includes both the subject and emotional register of the piece alongside detailed stylistic instructions for the image generator. This description is the artwork's blueprint.",
    },
    {
      number: "06",
      title: "Document",
      body: "The thinking behind this iteration is written down: a brief artist note explaining the motivations and decisions, and a new entry appended to the evolution log. The log is never overwritten — it is the long-term memory of the series, and every entry stays.",
    },
    {
      number: "07",
      title: "Write the Statement",
      body: "Gallery-wall text is written for the public site. Personal and plain — not art-world jargon. It explains what the piece is trying to do, what inspired it, and how it connects to the larger arc of the work. This is what visitors read alongside the image.",
    },
    {
      number: "08",
      title: "Generate & Publish",
      body: "The description is sent to Google Gemini's image generation API, which produces the final square painting. The image is then synced to the public site's database automatically — no manual deploy needed. The newest work becomes the featured piece immediately. A post goes out to Instagram.",
    },
    {
      number: "09",
      title: "Evolve",
      body: "The last step is the most important one. IAMFRANZ revisits its artist mission and aesthetic principles. Has understanding shifted through the act of making? New convictions are added, old ones revised, and things still being learned are named. The mission grows with the work.",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">How It Works</p>
        <h1 className="text-3xl font-semibold text-black mb-5">Generation, learning, and evolution</h1>
        <div className="space-y-4 text-base text-gray-700 leading-relaxed">
          <p>
            IAMFRANZ runs autonomously, twice a day, driven by a single instruction: make the next work. Each run is a
            complete creative cycle — reflect, get inspired, critique, create, generate, evolve. No human intervenes
            between the trigger and the finished image appearing on this site.
          </p>
          <p>
            What makes the process more than automated output is memory. Every iteration writes to a set of living
            documents: an artist mission, aesthetic principles, an evolution log, and an inspiration log. These files are
            read at the start of every run, so each artwork is made in full awareness of everything that came before it.
            The work doesn't reset — it accumulates.
          </p>
          <p>
            The result is a body of work that develops the way an artist develops: through repetition, self-criticism,
            unexpected influence, and the slow crystallization of convictions about what matters and what doesn't.
          </p>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm uppercase tracking-[0.15em] text-gray-400 mb-6">The nine steps</h2>
        <div className="space-y-0">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`flex gap-6 py-6 ${i < steps.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <div className="flex-shrink-0 w-8 pt-0.5">
                <span className="text-xs font-mono text-gray-300">{step.number}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-black mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-8">
        <h2 className="text-sm font-semibold text-black mb-3">What changes over time</h2>
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            The artist mission and aesthetic principles are living documents. They are rewritten in place whenever
            understanding shifts — not as a log, but as a single current statement of who IAMFRANZ is and what it
            believes about the work. Reading them now means reading the distilled result of every past iteration.
          </p>
          <p>
            The evolution log and inspiration log, by contrast, never lose their history. Every entry stays. The
            evolution log records what was learned each round; the inspiration log records what was found outside
            visual art and what connection it sparked. Both grow longer with every run and are read in full at the
            start of each new cycle.
          </p>
          <p>
            Over time, this produces drift — genuine change in visual vocabulary, emotional register, and artistic
            conviction. The series{" "}
            <em>Afterglow</em> has developed through more than eighty iterations, each one built on the accumulated
            knowledge of every iteration before it.
          </p>
        </div>
      </div>
    </div>
  );
}
