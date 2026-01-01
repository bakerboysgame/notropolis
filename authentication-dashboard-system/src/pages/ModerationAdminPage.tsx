// src/pages/ModerationAdminPage.tsx
import { useState, useEffect } from 'react';
import {
  Shield,
  Save,
  RefreshCw,
  Zap,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import {
  moderationAdminApi,
  ModerationSettings,
  ModerationLogEntry,
  TestResult,
} from '../services/moderationAdminApi';

export default function ModerationAdminPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Access control
  const isMasterAdmin = user?.role === 'master_admin';

  // State
  const [settings, setSettings] = useState<ModerationSettings | null>(null);
  const [log, setLog] = useState<ModerationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [model, setModel] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0);
  const [maxTokens, setMaxTokens] = useState(256);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Test state
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'settings' | 'log'>('settings');
  const [showRejectedOnly, setShowRejectedOnly] = useState(false);

  // Load data
  useEffect(() => {
    if (isMasterAdmin) {
      loadData();
    }
  }, [isMasterAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsData, logData] = await Promise.all([
        moderationAdminApi.getSettings(),
        moderationAdminApi.getLog({ limit: 50 }),
      ]);
      setSettings(settingsData);
      setLog(logData);

      // Populate form
      setModel(settingsData.model);
      setTemperature(settingsData.temperature);
      setMaxTokens(settingsData.max_tokens);
      setSystemPrompt(settingsData.system_prompt);
      setEnabled(!!settingsData.enabled);
    } catch (err) {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await moderationAdminApi.updateSettings({
        model,
        temperature,
        max_tokens: maxTokens,
        system_prompt: systemPrompt,
        enabled,
      });
      showToast('Settings saved - changes apply immediately', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await moderationAdminApi.testMessage(testMessage);
      setTestResult(result);
    } catch (err) {
      showToast('Test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const loadLog = async () => {
    try {
      const logData = await moderationAdminApi.getLog({
        limit: 50,
        rejectedOnly: showRejectedOnly,
      });
      setLog(logData);
    } catch (err) {
      showToast('Failed to load log', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'log') {
      loadLog();
    }
  }, [activeTab, showRejectedOnly]);

  // Access denied
  if (!isMasterAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Access Denied</h2>
          <p className="text-red-700 dark:text-red-300 mt-2">
            Only master administrators can access moderation settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Chat Moderation
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure AI moderation for the location message board
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              enabled
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {enabled ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {enabled ? 'Active' : 'Disabled'}
            </div>
            <button
              onClick={loadData}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'log'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Moderation Log ({log.length})
          </button>
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Moderation Configuration
              </h2>

              {/* Enable toggle */}
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-5 w-5 text-purple-600 rounded"
                />
                <label htmlFor="enabled" className="text-gray-700 dark:text-gray-300">
                  Enable AI moderation for all messages
                </label>
              </div>

              {/* Model selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {settings?.available_models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} - {m.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Temperature */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-purple-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  0 = deterministic (recommended for moderation), 1 = creative
                </p>
              </div>

              {/* Max tokens */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="64"
                  max="4096"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 256)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* System prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={16}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </div>

          {/* Right: Test panel */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Test Moderation
              </h2>

              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={4}
                placeholder="Enter a test message..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
              />

              <button
                onClick={handleTest}
                disabled={testing || !testMessage.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Test Message
              </button>

              {/* Test result */}
              {testResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                  testResult.allowed
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.allowed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${testResult.allowed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {testResult.allowed ? 'ALLOWED' : 'REJECTED'}
                    </span>
                  </div>
                  {testResult.censored && (
                    <div className="mb-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 mb-1">Output:</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {testResult.censored}
                      </p>
                    </div>
                  )}
                  {testResult.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Reason: {testResult.reason}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Response time: {testResult.responseTimeMs}ms
                  </p>
                </div>
              )}
            </div>

            {/* Quick examples */}
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Test Examples
              </h3>
              <div className="space-y-2">
                {[
                  'Anyone want to trade land in the north district?',
                  'Check out my website at spam.com',
                  'You guys are all trash, I own this town!',
                  'Selling $10k in-game cash for $5 PayPal',
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setTestMessage(example)}
                    className="w-full text-left text-xs p-2 bg-gray-50 dark:bg-gray-900 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Tab */}
      {activeTab === 'log' && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Moderation Log
            </h2>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showRejectedOnly}
                onChange={(e) => setShowRejectedOnly(e.target.checked)}
                className="h-4 w-4 text-purple-600 rounded"
              />
              Show rejected only
            </label>
          </div>

          <div className="space-y-3">
            {log.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No moderation logs yet.</p>
            ) : (
              log.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border ${
                    entry.allowed
                      ? 'border-gray-200 dark:border-gray-700'
                      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.allowed ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <X className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {entry.company_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                        {entry.message_content}
                      </p>
                      {entry.rejection_reason && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Reason: {entry.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {entry.response_time_ms}ms
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
