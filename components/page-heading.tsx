export function PageHeading({ title, kicker, children }: { title: string; kicker?: string; children?: React.ReactNode }) {
  return (
    <section className="mb-5 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker ? <p className="mb-1 text-xs font-black uppercase tracking-widest text-field">{kicker}</p> : null}
        <h1 className="text-3xl font-black tracking-normal text-ink sm:text-4xl">{title}</h1>
      </div>
      {children ? <div className="text-sm text-ink/65">{children}</div> : null}
    </section>
  );
}
