const steps = [
  { title: "Mention an agent in a space", body: "Type @Planner, @Researcher or any agent your group added. It reads the recent conversation and the space memory." },
  { title: "It replies in the chat", body: "The reply streams in for everyone. Research answers list the sources they used." },
  { title: "Actions wait for a person", body: "Checklists, polls and memory updates arrive as cards. Nothing runs until someone approves." },
];

/** Plain explanation of the core loop, shown beside the auth forms. */
export function HowItWorks() {
  return (
    <div className="max-w-md">
      <p className="text-sm text-paper/60">How agents work in a space</p>
      <ol className="mt-6 flex flex-col gap-7">
        {steps.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-4">
            <span aria-hidden className="grid size-8 place-items-center rounded-[22%] border border-paper/25 text-sm font-semibold text-paper/80">
              {i + 1}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-paper">{s.title}</h3>
              <p className="mt-1 text-paper/70">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
