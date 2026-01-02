// src/components/assets/ReferenceLibrary/UploadDropzone.tsx

import { useState, useCallback } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { referenceLibraryApi, ReferenceImage } from '../../../services/assetApi';
import { config } from '../../../config/environment';

interface UploadDropzoneProps {
  onUploadComplete: (image: ReferenceImage) => void;
  category?: string;
}

export default function UploadDropzone({
  onUploadComplete,
  category,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );

      if (files.length === 0) {
        setError('Please drop an image file');
        return;
      }

      await uploadFile(files[0]);
    },
    [category]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      await uploadFile(file);
      e.target.value = ''; // Reset input
    },
    [category]
  );

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate a name from the filename
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

      const result = await referenceLibraryApi.upload({
        file,
        name,
        category: category || 'general',
      });

      // Create a ReferenceImage object from the upload response
      // Use the API serve endpoint for thumbnails (not a direct R2 URL)
      const image: ReferenceImage = {
        id: result.id,
        name: result.name,
        category: result.category,
        thumbnailUrl: `${config.API_BASE_URL}/api/admin/assets/reference-library/serve/${encodeURIComponent(result.thumbnailKey)}`,
        r2_key: result.r2Key,
        thumbnail_r2_key: result.thumbnailKey,
        width: result.width,
        height: result.height,
        file_size: result.fileSize,
        created_at: new Date().toISOString(),
      };

      setSuccess(`Uploaded: ${name}`);
      onUploadComplete(image);

      // Clear success message after a delay
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        )}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload
              className={clsx(
                'w-10 h-10 mx-auto mb-3',
                isDragging ? 'text-purple-500' : 'text-gray-400'
              )}
            />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Drop an image here
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              PNG, JPG, WebP up to 10MB
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-purple-700 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              Browse Files
            </label>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}
    </div>
  );
}
