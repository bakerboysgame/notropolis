// src/components/assets/SceneTemplates.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Film, Save, Upload, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { assetApi, SceneTemplate } from '../../services/assetApi';
import { useToast } from '../ui/Toast';

export function SceneTemplates() {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<SceneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplate | null>(null);
  const [editingSlot, setEditingSlot] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [testCompanyId, setTestCompanyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await assetApi.getSceneTemplates();
      setTemplates(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: SceneTemplate) => {
    setSelectedTemplate(template);
    setEditingSlot(template.avatar_slot || { x: 0, y: 0, width: 300, height: 400 });
  };

  const handleSlotChange = (field: string, value: number) => {
    if (!editingSlot) return;
    setEditingSlot({ ...editingSlot, [field]: value });
  };

  const handleSaveSlot = async () => {
    if (!selectedTemplate || !editingSlot) return;
    setSaving(true);
    try {
      await assetApi.updateSceneTemplate(selectedTemplate.id, { avatar_slot: editingSlot });
      showToast('Slot position saved', 'success');
      await loadTemplates();
      // Update selected template with new slot
      setSelectedTemplate((prev) =>
        prev ? { ...prev, avatar_slot: editingSlot } : null
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedTemplate) return;
    setPublishing(true);
    try {
      await assetApi.publishSceneTemplate(selectedTemplate.id);
      showToast('Template published', 'success');
      await loadTemplates();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const renderPreview = useCallback(async () => {
    if (!selectedTemplate || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = selectedTemplate.width || 1280;
    canvas.height = selectedTemplate.height || 720;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill with gray background
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (selectedTemplate.background_url) {
      try {
        const bg = await loadImage(selectedTemplate.background_url);
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
      } catch {
        // Ignore background load errors
      }
    }

    // Draw avatar slot placeholder
    const slot = editingSlot || selectedTemplate.avatar_slot || { x: 0, y: 0, width: 300, height: 400 };
    const scaleX = canvas.width / (selectedTemplate.width || 1280);
    const scaleY = canvas.height / (selectedTemplate.height || 720);

    // Draw semi-transparent green fill
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.fillRect(
      slot.x * scaleX,
      slot.y * scaleY,
      slot.width * scaleX,
      slot.height * scaleY
    );

    // Draw dashed border
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      slot.x * scaleX,
      slot.y * scaleY,
      slot.width * scaleX,
      slot.height * scaleY
    );
    ctx.setLineDash([]);

    // Draw "Avatar Slot" label
    ctx.fillStyle = '#00ff00';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Avatar Slot',
      (slot.x + slot.width / 2) * scaleX,
      (slot.y + slot.height / 2) * scaleY
    );

    // Draw foreground
    if (selectedTemplate.foreground_url) {
      try {
        const fg = await loadImage(selectedTemplate.foreground_url);
        ctx.drawImage(fg, 0, 0, canvas.width, canvas.height);
      } catch {
        // Ignore foreground load errors
      }
    }
  }, [selectedTemplate, editingSlot]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const handleTestWithAvatar = async () => {
    if (!selectedTemplate || !testCompanyId) return;
    try {
      const { composite_url } = await assetApi.previewAvatarComposite(
        selectedTemplate.id,
        testCompanyId
      );
      if (composite_url) {
        window.open(composite_url, '_blank');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to preview', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Film className="w-6 h-6 text-orange-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Scene Templates</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure layered scene backgrounds with avatar placement slots
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Template List */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Templates</h3>
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className={clsx(
                  'border rounded-lg p-4 cursor-pointer transition-all',
                  selectedTemplate?.id === template.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                )}
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-32 h-20 bg-gray-100 dark:bg-gray-900 rounded overflow-hidden flex-shrink-0">
                    {template.background_url ? (
                      <img
                        src={template.background_url}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Film className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">
                      {template.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {template.description || 'No description'}
                    </p>
                    <div className="mt-1 flex gap-2">
                      <span
                        className={clsx(
                          'text-xs px-2 py-0.5 rounded',
                          template.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        )}
                      >
                        {template.is_active ? 'Active' : 'Draft'}
                      </span>
                      {template.foreground_url && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          Has Foreground
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No scene templates found
              </div>
            )}
          </div>
        </div>

        {/* Right: Template Editor */}
        <div>
          {selectedTemplate ? (
            <>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                {selectedTemplate.name}
              </h3>

              {/* Preview Canvas */}
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-2 mb-4">
                <canvas
                  ref={canvasRef}
                  className="w-full rounded border border-gray-200 dark:border-gray-700"
                  style={{ aspectRatio: `${selectedTemplate.width || 1280} / ${selectedTemplate.height || 720}` }}
                />
              </div>

              {/* Avatar Slot Editor */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Avatar Slot Position
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      X
                    </label>
                    <input
                      type="number"
                      value={editingSlot?.x ?? 0}
                      onChange={(e) => handleSlotChange('x', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Y
                    </label>
                    <input
                      type="number"
                      value={editingSlot?.y ?? 0}
                      onChange={(e) => handleSlotChange('y', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Width
                    </label>
                    <input
                      type="number"
                      value={editingSlot?.width ?? 300}
                      onChange={(e) => handleSlotChange('width', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Height
                    </label>
                    <input
                      type="number"
                      value={editingSlot?.height ?? 400}
                      onChange={(e) => handleSlotChange('height', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveSlot}
                  disabled={saving}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Slot Position
                </button>
              </div>

              {/* Test with Avatar */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Test with Avatar
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Company ID..."
                    value={testCompanyId}
                    onChange={(e) => setTestCompanyId(e.target.value)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={handleTestWithAvatar}
                    disabled={!testCompanyId}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Preview
                  </button>
                </div>
              </div>

              {/* Publish Button */}
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Publish to Game
              </button>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Select a scene template to configure
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
