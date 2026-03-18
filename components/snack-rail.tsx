import type { SnackRecord } from "@/lib/types";
import { SnackCard } from "@/components/snack-card";

type SnackRailProps = {
  title: string;
  eyebrow: string;
  snacks: SnackRecord[];
  emptyMessage: string;
};

export function SnackRail({ title, eyebrow, snacks, emptyMessage }: SnackRailProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-ink/45">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        </div>
      </div>
      {snacks.length ? (
        <div className="flex gap-5 overflow-x-auto pb-2">
          {snacks.map((snack) => (
            <SnackCard key={snack.id} snack={snack} />
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 px-6 py-8 text-sm text-ink/60">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}
