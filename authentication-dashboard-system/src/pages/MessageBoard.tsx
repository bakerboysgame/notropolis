import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, AlertCircle } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api, apiHelpers } from '../services/api';

interface Message {
  id: string;
  map_id: string;
  company_id: string;
  company_name: string;
  content: string;
  created_at: string;
}

export function MessageBoard(): JSX.Element {
  const { activeCompany } = useActiveCompany();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!activeCompany) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/game/messages', {
        params: { company_id: activeCompany.id },
      });

      if (response.data.success) {
        setMessages(response.data.data || []);
      } else {
        setError('Failed to load messages');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  // Mark messages as read when viewing the board
  const markAsRead = useCallback(async () => {
    if (!activeCompany) return;

    try {
      await api.post('/api/game/messages/read', {
        company_id: activeCompany.id,
      });
    } catch {
      // Silently fail - not critical
    }
  }, [activeCompany]);

  useEffect(() => {
    fetchMessages();
    markAsRead();
  }, [fetchMessages, markAsRead]);

  const handlePost = async () => {
    if (!newMessage.trim() || !activeCompany) return;

    setPosting(true);
    setPostError(null);

    try {
      const response = await api.post('/api/game/messages', {
        company_id: activeCompany.id,
        content: newMessage.trim(),
      });

      if (response.data.success) {
        setNewMessage('');
        await fetchMessages();
      } else {
        setPostError(response.data.error || 'Failed to post message');
      }
    } catch (err) {
      setPostError(apiHelpers.handleError(err));
    } finally {
      setPosting(false);
    }
  };

  // Redirect if no active company
  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  // Redirect if company is not in a location
  if (!activeCompany.current_map_id) {
    return <Navigate to={`/companies/${activeCompany.id}`} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/companies/${activeCompany.id}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to {activeCompany.name}
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-blue-400" />
            Message Board
          </h1>
          <p className="text-gray-400 mt-1">
            Post messages visible to everyone in this town
          </p>
        </div>

        {/* Prison Warning */}
        {activeCompany.is_in_prison && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700 mb-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-bold">Cannot Post Messages</p>
              <p className="text-red-300 text-sm">
                Your company is in prison. You can still read messages, but cannot post until you pay your fine.
              </p>
            </div>
          </div>
        )}

        {/* New message form */}
        {!activeCompany.is_in_prison && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Write a message to this town..."
              maxLength={500}
              rows={3}
              className="w-full p-3 bg-gray-700 text-white rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-gray-500">{newMessage.length}/500</span>
              <button
                onClick={handlePost}
                disabled={posting || !newMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
            {postError && (
              <p className="text-red-400 text-sm mt-2">{postError}</p>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading messages...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Messages */}
        {!loading && !error && (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-white">{msg.company_name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-gray-300 whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}

            {messages.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">No messages yet. Be the first!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBoard;
