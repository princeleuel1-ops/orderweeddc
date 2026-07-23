import { getDataStatusPresentation } from '@/lib/data-status.mjs';

type Props = {
  dataStatus: string;
  isDemonstration: boolean;
  verifiedAt?: Date | null;
  freshnessExpiresAt?: Date | null;
  compact?: boolean;
};

const toneClasses: Record<string, string> = {
  demo: 'border-violet-500/30 bg-violet-500/10 text-violet-800',
  pending: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-800',
  verified: 'border-brand-primary/30 bg-brand-primary/10 text-brand-primary',
  stale: 'border-orange-500/35 bg-orange-500/10 text-orange-800',
  disputed: 'border-red-400/30 bg-red-400/10 text-red-700',
};

export function DataStatusBadge({
  dataStatus,
  isDemonstration,
  verifiedAt,
  freshnessExpiresAt,
  compact = false,
}: Props) {
  const presentation = getDataStatusPresentation({
    dataStatus,
    isDemonstration,
    verifiedAt,
    freshnessExpiresAt,
  });

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wider ${toneClasses[presentation.tone]} ${
        compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      }`}
      title={presentation.description}
    >
      {presentation.label}
    </span>
  );
}
