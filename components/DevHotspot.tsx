import React from 'react';
import { Code, Info } from 'lucide-react';
import { DevDocItem } from '../types';

interface DevHotspotProps {
  data: DevDocItem;
  position?: string;
}

export const DevHotspot: React.FC<DevHotspotProps> = ({ data, position = "top-0 right-0" }) => {
  return (
    <div className={`absolute ${position} z-50 group`}>
      <button className="bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform animate-pulse group-hover:animate-none ring-2 ring-white">
        <Code size={16} strokeWidth={2.5} />
      </button>
      
      <div className="hidden group-hover:block absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-slate-800 text-slate-200 text-xs rounded-xl shadow-2xl p-4 border border-slate-600 animate-in fade-in slide-in-from-top-2 duration-200 z-[60]">
        {/* Triangle arrow */}
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 border-t border-l border-slate-600 rotate-45"></div>

        <h4 className="font-bold text-white text-sm mb-2 flex items-center border-b border-slate-700 pb-2">
          <Info size={14} className="mr-2 text-rose-400"/>
          {data.title}
        </h4>
        <div className="text-rose-300 font-mono text-[10px] mb-3 bg-slate-900/60 px-2 py-1 rounded w-fit border border-slate-700/50">
          Tech: {data.techStack}
        </div>
        <div className="space-y-2 leading-relaxed opacity-90 text-slate-300">
          {Array.isArray(data.desc) ? (
            data.desc.map((line, i) => <p key={i} className="flex"><span className="mr-2">•</span>{line}</p>)
          ) : (
            <p>{data.desc}</p>
          )}
        </div>
      </div>
    </div>
  );
};