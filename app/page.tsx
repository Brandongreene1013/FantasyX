import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Trophy } from "lucide-react";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";

export default function Home() {
  return (
    <div className="pb-20">
      <section className="grid min-h-[calc(100vh-14rem)] content-center gap-8 py-8 sm:grid-cols-[1.1fr_0.9fr] sm:items-center sm:py-14">
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-field">Free-play Week 1 markets</p>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-normal text-ink sm:text-6xl">
            The Fantasy Football Performance Market
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-ink/65 sm:text-lg">
            Trade mock-credit YES or NO shares on whether NFL stars finish Top 3, Top 5, or Top 10 at their position in weekly half-PPR fantasy scoring.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded bg-ink px-5 text-sm font-black text-white transition hover:bg-field"
              href="/markets"
            >
              Start Trading Week 1
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              className="inline-flex h-12 items-center justify-center rounded border border-ink/15 bg-white px-5 text-sm font-black text-ink transition hover:bg-ink/5"
              href="/portfolio"
            >
              View Portfolio
            </Link>
          </div>
        </div>

        <div className="rounded border border-ink/10 bg-white p-4 shadow-soft">
          <div className="rounded bg-field p-4 text-white">
            <p className="text-xs font-black uppercase tracking-widest text-white">Sample market</p>
            <h2 className="mt-2 text-2xl font-black">Will Josh Allen finish as a Top 3 QB?</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded bg-white p-3 text-ink">
                <p className="text-xs font-black text-ink/70">YES</p>
                <p className="text-3xl font-black">31%</p>
              </div>
              <div className="rounded bg-white p-3 text-ink">
                <p className="text-xs font-black text-ink/70">NO</p>
                <p className="text-3xl font-black">69%</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <Explainer icon={<Trophy className="h-5 w-5" />} title="Top 3" text="A player must finish inside the elite tier at his position for the week." />
            <Explainer icon={<BarChart3 className="h-5 w-5" />} title="Top 5" text="A balanced market for strong weekly starters and high-upside plays." />
            <Explainer icon={<CheckCircle2 className="h-5 w-5" />} title="Top 10" text="A wider finish range for dependable fantasy performances." />
          </div>
        </div>
      </section>

      <AnalyticsDashboard />
    </div>
  );
}

function Explainer({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded border border-ink/10 bg-chalk p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-white text-field">{icon}</div>
      <div>
        <p className="font-black">{title}</p>
        <p className="text-sm font-semibold leading-5 text-ink/70">{text}</p>
      </div>
    </div>
  );
}
