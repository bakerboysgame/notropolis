import { useAvatarImage } from '../../hooks/useAvatar';

interface AvatarPreviewProps {
  companyId: string;
  size?: number;
}

export function AvatarPreview({ companyId, size = 200 }: AvatarPreviewProps) {
  const { data: avatar, isLoading } = useAvatarImage(companyId);

  if (isLoading) {
    return (
      <div
        className="bg-gray-700 rounded-lg flex items-center justify-center animate-pulse"
        style={{ width: size, height: size }}
      />
    );
  }

  if (!avatar?.layers || avatar.layers.length === 0) {
    return (
      <div
        className="bg-gray-700 rounded-lg flex items-center justify-center mx-auto"
        style={{ width: size, height: size }}
      >
        <span className="text-4xl">&#128100;</span>
      </div>
    );
  }

  return (
    <div
      className="relative bg-gray-700 rounded-lg overflow-hidden mx-auto"
      style={{ width: size, height: size }}
    >
      {avatar.layers.map((layer: any, i: number) => (
        <img
          key={layer.category}
          src={layer.url}
          alt={layer.category}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: i }}
        />
      ))}
    </div>
  );
}

// Smaller version for lists/thumbnails
export function AvatarThumbnail({ companyId }: { companyId: string }) {
  return <AvatarPreview companyId={companyId} size={40} />;
}
