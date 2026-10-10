import React from 'react';
import { Radio } from 'lucide-react';

export interface TelciaLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  glow?: boolean;
}

export const TelciaLogo: React.FC<TelciaLogoProps> = ({
  size = 'md',
  className = '',
  glow = true,
}) => {
  const sizeMap = {
    xs: { outer: 'w-6 h-6 rounded-lg', p: 'p-[1px]', inner: 'rounded-[7px]', red: 'w-3 h-3', icon: 'w-3 h-3' },
    sm: { outer: 'w-8 h-8 rounded-xl', p: 'p-[1.5px]', inner: 'rounded-[10px]', red: 'w-4 h-4 shadow-[0_0_8px_rgba(244,42,65,0.85)]', icon: 'w-4 h-4' },
    md: { outer: 'w-10 h-10 rounded-xl', p: 'p-[1.5px]', inner: 'rounded-[10px]', red: 'w-5 h-5 shadow-[0_0_10px_rgba(244,42,65,0.85)]', icon: 'w-5 h-5' },
    lg: { outer: 'w-12 h-12 rounded-2xl', p: 'p-[2px]', inner: 'rounded-[14px]', red: 'w-6 h-6 shadow-[0_0_12px_rgba(244,42,65,0.85)]', icon: 'w-6 h-6' },
    xl: { outer: 'w-16 h-16 rounded-2xl', p: 'p-[2px]', inner: 'rounded-[14px]', red: 'w-7 h-7 shadow-[0_0_14px_rgba(244,42,65,0.85)]', icon: 'w-7 h-7' },
  };

  const s = sizeMap[size] || sizeMap.md;

  return (
    <div className={`relative shrink-0 select-none ${s.outer} ${className}`}>
      {glow && (
        <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-tr from-[#006a4e] via-emerald-500 to-teal-400 blur-sm opacity-60" />
      )}
      <div className={`relative w-full h-full rounded-[inherit] bg-gradient-to-tr from-[#006a4e] via-emerald-600 to-[#004d38] ${s.p} shadow-md`}>
        <div className={`w-full h-full bg-[#070d18] ${s.inner} flex items-center justify-center relative overflow-hidden`}>
          {/* Sovereign Bangladesh Red Core Glow */}
          <span className={`absolute ${s.red} rounded-full bg-[#f42a41] opacity-95 animate-pulse`} />
          {/* White Radio Pulse Antenna Icon */}
          <Radio className={`${s.icon} text-white relative z-10 drop-shadow-md`} />
        </div>
      </div>
    </div>
  );
};

export default TelciaLogo;
