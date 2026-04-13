import React, { useState } from 'react';
import { MessageSquare, Send, User, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useComments } from '../../hooks/useComments';

interface IdeaCommentsProps {
  ideaId: string;
  user: any;
  handleLogin: () => void;
}

export const IdeaComments: React.FC<IdeaCommentsProps> = ({ ideaId, user, handleLogin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const { comments, loading, postComment, deleteComment } = useComments(ideaId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      handleLogin();
      return;
    }
    if (!text.trim()) return;
    await postComment(user, text);
    setText('');
  };

  return (
    <div className="border-t border-zinc-900 mt-4 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-3 px-4 flex items-center justify-between text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Community Threads ({comments.length})
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-6 space-y-4"
          >
            {/* Input */}
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                placeholder={
                  user
                    ? 'Share your feedback or ask a question...'
                    : 'Sign in to join the discussion'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
              <button
                type="submit"
                disabled={!text.trim() && !!user}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:text-emerald-400 disabled:text-zinc-700 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* List */}
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center py-4 text-xs text-zinc-600 italic">
                  No comments yet. Be the first to start the thread.
                </p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex gap-3 animate-in fade-in slide-in-from-top-1"
                  >
                    <div className="flex-shrink-0">
                      {comment.userPhoto ? (
                        <img
                          src={comment.userPhoto}
                          className="w-8 h-8 rounded-full border border-zinc-800"
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                          <User className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">
                          {comment.userName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
                            {comment.timestamp ? 'JUST NOW' : 'PENDING...'}
                          </span>
                          {user && user.uid === comment.userId && (
                            <button
                              onClick={() => deleteComment(comment.id, comment.userId, user)}
                              className="text-zinc-700 hover:text-red-500 transition-colors"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
