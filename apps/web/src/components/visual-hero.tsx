// CANA × ORDERWEEDDC SOVEREIGN VISUAL HERO COMPONENT
import React from 'react';
import Image from 'next/image';
import { VisualSystemClient } from '@/lib/visual-system';

interface VisualHeroProps {
  slotId: string;
  title: string;
  subtitle?: string;
  kicker?: string;
  theme?: 'DAY_LIMESTONE' | 'NIGHT_OBSIDIAN';
  priority?: boolean;
}

export function VisualHero({
  slotId,
  title,
  subtitle,
  kicker,
  theme = 'NIGHT_OBSIDIAN',
  priority = true
}: VisualHeroProps) {
  const visual = VisualSystemClient.resolveSlot(slotId, theme);
  const isDark = theme === 'NIGHT_OBSIDIAN';

  return (
    <section className={`relative w-full overflow-hidden rounded-3xl border transition-colors duration-500 my-6 ${
      isDark 
        ? 'bg-[#0A0A0C] border-white/10 text-white shadow-2xl' 
        : 'bg-[#F7F7F9] border-black/5 text-[#1C1D21] shadow-lg'
    }`}>
      {/* Background Graphic Asset */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-luminosity overflow-hidden">
        <Image
          src={visual.asset_url}
          alt={visual.alt_text}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
          className="object-cover object-center transform scale-105 filter blur-[1px]"
        />
        <div className={`absolute inset-0 ${
          isDark 
            ? 'bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/80 to-[#0A0A0C]/60' 
            : 'bg-gradient-to-t from-[#F7F7F9] via-[#F7F7F9]/80 to-[#F7F7F9]/60'
        }`} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 aspect-[16/9] w-full min-h-[320px] max-h-[500px] flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 backdrop-blur-md">
            <span>{kicker || 'Sovereign Visual System'}</span>
            <span className="opacity-50">•</span>
            <span className="text-[10px] opacity-80">{visual.mechanism.replace('OW_MECH_', '')}</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            {title}
          </h1>
          
          {subtitle && (
            <p className={`text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
