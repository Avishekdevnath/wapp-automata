import React, { useState } from 'react';
import { User, Users, UserCheck, Building2, Headphones } from 'lucide-react';

interface ProfileAvatarProps {
  name?: string | null;
  phone?: string | null;
  isGroup?: boolean;
  isOutbound?: boolean;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CARRIER_KEYWORDS = [
  'carrier',
  'desk',
  'telecom',
  'exchange',
  'voip',
  'routes',
  'ltd',
  'llc',
  'inc',
  'corp',
  'global',
  'wholesale',
  'routing',
  'network',
];

const AVATAR_ASSETS = [
  '/avatars/male-1.svg',
  '/avatars/female-1.svg',
  '/avatars/male-2.svg',
  '/avatars/female-2.svg',
];

// 6 Balanced Color Themes for Fallback Icons
const PALETTES = [
  {
    bg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: User,
  },
  {
    bg: 'bg-sky-500/15 dark:bg-sky-500/20',
    border: 'border-sky-500/30',
    text: 'text-sky-600 dark:text-sky-400',
    icon: User,
  },
  {
    bg: 'bg-purple-500/15 dark:bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
    icon: User,
  },
  {
    bg: 'bg-amber-500/15 dark:bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    icon: Building2,
  },
  {
    bg: 'bg-rose-500/15 dark:bg-rose-500/20',
    border: 'border-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    icon: User,
  },
  {
    bg: 'bg-teal-500/15 dark:bg-teal-500/20',
    border: 'border-teal-500/30',
    text: 'text-teal-600 dark:text-teal-400',
    icon: Building2,
  },
];

function getHashIndex(str?: string | null, mod = 4): number {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % mod;
}

function isCarrierCompany(name?: string | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CARRIER_KEYWORDS.some((kw) => lower.includes(kw));
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  name,
  phone,
  isGroup,
  isOutbound,
  avatarUrl,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg text-xs',
    md: 'w-9 h-9 rounded-xl text-sm',
    lg: 'w-11 h-11 rounded-2xl text-base',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4.5 h-4.5',
    lg: 'w-5.5 h-5.5',
  }[size];

  const displayName = name || phone || (isOutbound ? 'You' : isGroup ? 'Wholesale Group' : 'Carrier Trader');

  // 1. External Photo Avatar if available and valid
  if (avatarUrl && !imgError) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden ring-1 ring-slate-200 dark:ring-dark-700 shadow-xs ${sizeClasses} ${className}`}
        title={displayName}
      >
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full object-cover rounded-[inherit]"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // 2. Determine High-Resolution Vector Illustrated Avatar
  let targetSvg: string;
  let FallbackIcon = User;
  let fallbackColorClass = 'text-slate-600 dark:text-slate-300';

  if (isOutbound) {
    targetSvg = '/avatars/operator.svg';
    FallbackIcon = Headphones;
    fallbackColorClass = 'text-indigo-600 dark:text-indigo-300';
  } else if (isGroup) {
    targetSvg = '/avatars/group.svg';
    FallbackIcon = Users;
    fallbackColorClass = 'text-sky-600 dark:text-sky-300';
  } else if (isCarrierCompany(name)) {
    targetSvg = '/avatars/carrier.svg';
    FallbackIcon = Building2;
    fallbackColorClass = 'text-emerald-600 dark:text-emerald-300';
  } else {
    const assetIdx = getHashIndex(phone || name, AVATAR_ASSETS.length);
    targetSvg = AVATAR_ASSETS[assetIdx];
    FallbackIcon = assetIdx % 2 === 0 ? User : UserCheck;
    fallbackColorClass = 'text-slate-600 dark:text-slate-300';
  }

  // If local SVG fails to load, gracefully fall back to Lucide icon with vibrant palette
  if (imgError) {
    const palette = PALETTES[getHashIndex(phone || name, PALETTES.length)];
    const IconComp = FallbackIcon || palette.icon;
    return (
      <div
        className={`relative shrink-0 flex items-center justify-center ${palette.bg} border ${palette.border} ${fallbackColorClass || palette.text} shadow-xs transition-colors ${sizeClasses} ${className}`}
        title={displayName}
      >
        <IconComp className={iconSizes} />
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden ring-1 ring-slate-200/80 dark:ring-dark-700/80 shadow-xs transition-transform hover:scale-105 ${sizeClasses} ${className}`}
      title={displayName}
    >
      <img
        src={targetSvg}
        alt={displayName}
        className="w-full h-full object-cover rounded-[inherit] select-none"
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </div>
  );
};
