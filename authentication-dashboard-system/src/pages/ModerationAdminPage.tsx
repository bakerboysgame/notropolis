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
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import {
  moderationAdminApi,
  ModerationSettings,
  ModerationLogEntry,
  TestResult,
  AttackMessageEntry,
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
  const [chatUserPrompt, setChatUserPrompt] = useState('');
  const [nameUserPrompt, setNameUserPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Attack moderation form state
  const [attackSystemPrompt, setAttackSystemPrompt] = useState('');
  const [attackUserPrompt, setAttackUserPrompt] = useState('');
  const [attackModerationEnabled, setAttackModerationEnabled] = useState(true);

  // Name moderation form state
  const [nameSystemPrompt, setNameSystemPrompt] = useState('');
  const [nameModerationEnabled, setNameModerationEnabled] = useState(true);

  // Test state
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Attack test state
  const [attackTestMessage, setAttackTestMessage] = useState('');
  const [attackTestResult, setAttackTestResult] = useState<TestResult | null>(null);
  const [attackTesting, setAttackTesting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'settings' | 'attack_settings' | 'name_settings' | 'log' | 'attacks'>('settings');
  const [showRejectedOnly, setShowRejectedOnly] = useState(false);

  // Attack messages state
  const [attackMessages, setAttackMessages] = useState<AttackMessageEntry[]>([]);
  const [attackMessagesStatus, setAttackMessagesStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [processingAttackId, setProcessingAttackId] = useState<number | null>(null);

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
      setChatUserPrompt(settingsData.chat_user_prompt || '');
      setNameUserPrompt(settingsData.name_user_prompt || '');
      setEnabled(!!settingsData.enabled);

      // Populate attack settings
      setAttackSystemPrompt(settingsData.attack_system_prompt || '');
      setAttackUserPrompt(settingsData.attack_user_prompt || '');
      setAttackModerationEnabled(!!settingsData.attack_moderation_enabled);

      // Populate name settings
      setNameSystemPrompt(settingsData.name_system_prompt || '');
      setNameModerationEnabled(!!settingsData.name_moderation_enabled);
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
        chat_user_prompt: chatUserPrompt,
        name_user_prompt: nameUserPrompt,
        enabled,
        attack_system_prompt: attackSystemPrompt,
        attack_user_prompt: attackUserPrompt,
        attack_moderation_enabled: attackModerationEnabled,
        name_system_prompt: nameSystemPrompt,
        name_moderation_enabled: nameModerationEnabled,
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

  const handleTestAttack = async () => {
    if (!attackTestMessage.trim()) return;
    setAttackTesting(true);
    setAttackTestResult(null);
    try {
      const result = await moderationAdminApi.testAttackMessage(attackTestMessage);
      setAttackTestResult(result);
    } catch (err) {
      showToast('Attack test failed', 'error');
    } finally {
      setAttackTesting(false);
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

  // Load attack messages
  const loadAttackMessages = async () => {
    try {
      const messages = await moderationAdminApi.getAttackMessages({
        status: attackMessagesStatus,
        limit: 50,
      });
      setAttackMessages(messages);
    } catch (err) {
      showToast('Failed to load attack messages', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'attacks') {
      loadAttackMessages();
    }
  }, [activeTab, attackMessagesStatus]);

  const handleApproveAttackMessage = async (id: number) => {
    setProcessingAttackId(id);
    try {
      await moderationAdminApi.approveAttackMessage(id);
      showToast('Message approved', 'success');
      loadAttackMessages();
    } catch (err) {
      showToast('Failed to approve message', 'error');
    } finally {
      setProcessingAttackId(null);
    }
  };

  const handleRejectAttackMessage = async (id: number) => {
    setProcessingAttackId(id);
    try {
      await moderationAdminApi.rejectAttackMessage(id);
      showToast('Message rejected', 'success');
      loadAttackMessages();
    } catch (err) {
      showToast('Failed to reject message', 'error');
    } finally {
      setProcessingAttackId(null);
    }
  };

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
                Moderation
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure AI moderation for chat and company/boss name creation
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
            Chat Settings
          </button>
          <button
            onClick={() => setActiveTab('attack_settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'attack_settings'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Attack Settings
          </button>
          <button
            onClick={() => setActiveTab('name_settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'name_settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Name Settings
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
          <button
            onClick={() => setActiveTab('attacks')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'attacks'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Attack Messages
            {attackMessagesStatus === 'pending' && attackMessages.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {attackMessages.length}
              </span>
            )}
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
                  Enable AI moderation for chat and names
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
                  Chat System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
              </div>

              {/* Chat user prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Chat User Prompt
                </label>
                <textarea
                  value={chatUserPrompt}
                  onChange={(e) => setChatUserPrompt(e.target.value)}
                  rows={3}
                  placeholder="Message to review:\n\n{content}"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{content}'}</code> as placeholder for the message
                </p>
              </div>

              {/* Name user prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name User Prompt (Boss/Company)
                </label>
                <textarea
                  value={nameUserPrompt}
                  onChange={(e) => setNameUserPrompt(e.target.value)}
                  rows={2}
                  placeholder='{type} to review: "{content}"'
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{type}'}</code> for "boss name" or "company name" and <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{content}'}</code> for the actual name
                </p>
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

      {/* Attack Settings Tab */}
      {activeTab === 'attack_settings' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Attack Configuration */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Attack Message Moderation
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Configure AI moderation for messages left by players when attacking buildings. These prompts are more lenient to allow competitive banter.
              </p>

              {/* Enable toggle */}
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <input
                  type="checkbox"
                  id="attack_enabled"
                  checked={attackModerationEnabled}
                  onChange={(e) => setAttackModerationEnabled(e.target.checked)}
                  className="h-5 w-5 text-orange-600 rounded"
                />
                <label htmlFor="attack_enabled" className="text-gray-700 dark:text-gray-300">
                  Enable AI moderation for attack messages
                </label>
              </div>

              {/* Attack system prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attack System Prompt
                </label>
                <textarea
                  value={attackSystemPrompt}
                  onChange={(e) => setAttackSystemPrompt(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
              </div>

              {/* Attack user prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attack User Prompt
                </label>
                <textarea
                  value={attackUserPrompt}
                  onChange={(e) => setAttackUserPrompt(e.target.value)}
                  rows={3}
                  placeholder="Attack message to review:\n\n{content}"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{content}'}</code> as placeholder for the message
                </p>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
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
                Test Attack Moderation
              </h2>

              <textarea
                value={attackTestMessage}
                onChange={(e) => setAttackTestMessage(e.target.value)}
                rows={4}
                placeholder="Enter a test attack message..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
              />

              <button
                onClick={handleTestAttack}
                disabled={attackTesting || !attackTestMessage.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {attackTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Test Message
              </button>

              {/* Test result */}
              {attackTestResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                  attackTestResult.allowed
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {attackTestResult.allowed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${attackTestResult.allowed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {attackTestResult.allowed ? 'ALLOWED' : 'REJECTED'}
                    </span>
                  </div>
                  {attackTestResult.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Reason: {attackTestResult.reason}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Response time: {attackTestResult.responseTimeMs}ms
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
                  'Your building is mine now, sucker!',
                  'GG easy, come at me bro',
                  'I will burn down your whole empire!',
                  'This town belongs to the Malone family now',
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setAttackTestMessage(example)}
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

      {/* Name Settings Tab */}
      {activeTab === 'name_settings' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Name Configuration */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Name Moderation (Boss & Company)
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Configure AI moderation for boss names and company names when players create or update them.
              </p>

              {/* Enable toggle */}
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <input
                  type="checkbox"
                  id="name_enabled"
                  checked={nameModerationEnabled}
                  onChange={(e) => setNameModerationEnabled(e.target.checked)}
                  className="h-5 w-5 text-blue-600 rounded"
                />
                <label htmlFor="name_enabled" className="text-gray-700 dark:text-gray-300">
                  Enable AI moderation for boss/company names
                </label>
              </div>

              {/* Name system prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name System Prompt
                </label>
                <textarea
                  value={nameSystemPrompt}
                  onChange={(e) => setNameSystemPrompt(e.target.value)}
                  rows={14}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
              </div>

              {/* Name user prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name User Prompt
                </label>
                <textarea
                  value={nameUserPrompt}
                  onChange={(e) => setNameUserPrompt(e.target.value)}
                  rows={3}
                  placeholder='{type} to review: "{content}"'
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{type}'}</code> for "boss name" or "company name" and <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{content}'}</code> for the actual name
                </p>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </div>

          {/* Right: Info panel */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Name Moderation Info
              </h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
                <p>
                  Name moderation runs when players:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Create a new company</li>
                  <li>Change their boss name</li>
                  <li>Rename their company</li>
                </ul>
                <p className="mt-4">
                  Rejected names prevent the action and show an error to the player.
                </p>
              </div>
            </div>

            {/* Example names */}
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Example Names to Allow
              </h3>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                <p>The Corleone Family</p>
                <p>Big Tony's Enterprises</p>
                <p>Shady Deals Inc.</p>
                <p>Don Vito</p>
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

      {/* Attack Messages Tab */}
      {activeTab === 'attacks' && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Attack Message Moderation
            </h2>
            <div className="flex items-center gap-4">
              <select
                value={attackMessagesStatus}
                onChange={(e) => setAttackMessagesStatus(e.target.value as typeof attackMessagesStatus)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
              <button
                onClick={loadAttackMessages}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Players can leave messages when attacking buildings. These messages require approval before being visible on buildings.
          </p>

          <div className="space-y-3">
            {attackMessages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {attackMessagesStatus === 'pending'
                  ? 'No pending messages to review.'
                  : 'No messages found.'}
              </p>
            ) : (
              attackMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg border ${
                    msg.message_status === 'pending'
                      ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10'
                      : msg.message_status === 'approved'
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Message content */}
                      <p className="text-lg text-gray-900 dark:text-gray-100 mb-2 italic">
                        "{msg.message}"
                      </p>

                      {/* Attacker info */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          From: {msg.attacker_boss_name} ({msg.attacker_company_name})
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                          {msg.trick_type.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Target info */}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Target: {msg.building_name} owned by {msg.target_company_name} at ({msg.x}, {msg.y}) in {msg.map_name}
                      </p>

                      {/* Timestamp */}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(msg.created_at).toLocaleString()}
                      </p>

                      {/* Rejection reason */}
                      {msg.message_rejection_reason && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Rejected: {msg.message_rejection_reason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {msg.message_status === 'pending' && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleApproveAttackMessage(msg.id)}
                          disabled={processingAttackId === msg.id}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {processingAttackId === msg.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectAttackMessage(msg.id)}
                          disabled={processingAttackId === msg.id}
                          className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {processingAttackId === msg.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Status badge */}
                    {msg.message_status !== 'pending' && (
                      <span className={`px-2 py-1 text-xs rounded ${
                        msg.message_status === 'approved'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {msg.message_status}
                      </span>
                    )}
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
