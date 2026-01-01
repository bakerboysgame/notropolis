import { useEffect, useState } from 'react';
import { X, Gift } from 'lucide-react';

interface UnlockedItem {
  id: string;
  name: string;
  category: string;
  rarity: string;
  r2_key: string;
}

interface UnlockNotificationProps {
  items: UnlockedItem[];
  onDismiss: () => void;
}

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// R2 public URL for avatar assets
const R2_PUBLIC_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';

export function UnlockNotification({ items, onDismiss }: UnlockNotificationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 500); // Wait for fade out
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (items.length === 0) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="bg-gray-800 border-2 border-yellow-500 rounded-lg p-4 shadow-2xl max-w-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 text-yellow-400">
            <Gift className="w-5 h-5" />
            <span className="font-bold">New Item Unlocked!</span>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onDismiss, 500);
            }}
            className="text-gray-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded">
            <div className="w-12 h-12 bg-gray-600 rounded overflow-hidden">
              <img
                src={`${R2_PUBLIC_URL}/${item.r2_key}`}
                alt={item.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-white font-bold">{item.name}</p>
              <p
                className="text-sm capitalize"
                style={{ color: RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] }}
              >
                {item.rarity} {item.category}
              </p>
            </div>
          </div>
        ))}

        <p className="text-gray-400 text-xs mt-3 text-center">
          Visit Avatar to equip your new item!
        </p>
      </div>
    </div>
  );
}
