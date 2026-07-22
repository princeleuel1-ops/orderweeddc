'use client';

import { useState } from 'react';

type Props = {
  retailerId: string;
};

export default function FavoriteButton({ retailerId }: Props) {
  const [isFavorited, setIsFavorited] = useState(false);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorited(!isFavorited);
  };

  return (
    <button
      onClick={toggleFavorite}
      title={isFavorited ? 'Remove from Bookmarks' : 'Add to Bookmarks'}
      className={`text-xs font-bold px-2 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
        isFavorited
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
          : 'bg-brand-background border-brand-border text-slate-500 hover:border-black'
      }`}
    >
      <span>{isFavorited ? '★' : '☆'}</span>
      <span>{isFavorited ? 'Saved' : 'Save'}</span>
    </button>
  );
}
