import Image from "next/image";
import Link from "next/link";
import type { SnackRecord } from "@/lib/types";
import { formatPrice, formatRating } from "@/lib/utils";

type SnackCardProps = {
  snack: SnackRecord;
};

export function SnackCard({ snack }: SnackCardProps) {
  return (
    <Link
      href={`/snacks/${snack.slug}`}
      className="group flex min-w-[260px] max-w-[280px] flex-col overflow-hidden rounded-[28px] bg-white shadow-card transition duration-200 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        <Image
          src={snack.primaryImageUrl}
          alt={snack.name}
          fill
          className="object-cover transition duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 280px"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">{snack.brand}</p>
            <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-tight text-ink">{snack.name}</h3>
          </div>
          <div className="rounded-2xl bg-saffron/20 px-3 py-2 text-right text-sm font-semibold text-ink">
            {formatRating(snack.averageRating)}
          </div>
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-ink/70">{snack.description}</p>
        <div className="mt-auto flex items-center justify-between text-sm text-ink/60">
          <span>
            {snack.country} · {snack.category}
          </span>
          <span className="font-semibold text-ink">{formatPrice(snack.price)}</span>
        </div>
      </div>
    </Link>
  );
}
