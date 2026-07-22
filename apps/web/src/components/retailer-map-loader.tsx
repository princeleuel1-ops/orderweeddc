"use client";

import dynamic from 'next/dynamic';

const DynamicRetailerMap = dynamic(() => import('@/components/retailer-map'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center text-xs text-slate-400 font-sans">Initializing Interactive Map...</div>
});

type RetailerPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
};

export default function RetailerMapLoader({ retailers }: { retailers: RetailerPin[] }) {
  return <DynamicRetailerMap retailers={retailers} />;
}
