import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, ChevronUp, Reply, Plus, Users, Loader2, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getTopics, createTopic, getTopicWithPosts, createPost, toggleVote, getPresence,
  DiscussionTopic, DiscussionPost 
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface DiscussionSectionProps {
  tmdbId: number;
  mediaType: string;
  movieTitle: string;
  onLoginRequired: () => void;
}

export function DiscussionSection({ tmdbId, mediaType, movieTitle, onLoginRequired }: DiscussionSectionProps) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showNewTopicForm, setShowNewTopicForm] = useState(false);
  const [newTopicPrompt, setNewTopicPrompt] = useState('');

  const { data: topics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ['topics', tmdbId, mediaType],
    queryFn: () => getTopics(tmdbId, mediaType),
    refetchInterval: 10000,
  });

  const { data: presence } = useQuery({
    queryKey: ['presence', tmdbId],
    queryFn: () => getPresence(tmdbId),
    refetchInterval: 30000,
  });

  const createTopicMutation = useMutation({
    mutationFn: (prompt: string) => createTopic({
      tmdbId,
      mediaType,
      title: movieTitle,
      prompt,
    }),
    onSuccess: (topic) => {
      queryClient.invalidateQueries({ queryKey: ['topics', tmdbId, mediaType] });
      setNewTopicPrompt('');
      setShowNewTopicForm(false);
      setSelectedTopic(topic.id);
    },
  });

  const handleCreateTopic = () => {
    if (!isAuthenticated) {
      onLoginRequired();
      return;
    }
    if (!newTopicPrompt.trim() || newTopicPrompt.length < 5) return;
    createTopicMutation.mutate(newTopicPrompt.trim());
  };

  const handleStartDiscussion = () => {
    if (!isAuthenticated) {
      onLoginRequired();
      return;
    }
    setShowNewTopicForm(true);
  };

  return (
    <div className="mt-12 border-t border-zinc-800 pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="text-amber-500" size={24} />
          <h2 className="text-2xl font-bold text-white">Discussions</h2>
        </div>
        {presence && presence.count > 0 && (
          <div className="flex items-center gap-2 text-zinc-400 text-sm bg-zinc-800/50 px-3 py-1.5 rounded-full">
            <Users size={14} className="text-emerald-500" />
            <span>{presence.count} online</span>
          </div>
        )}
      </div>

      {topicsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      ) : (
        <>
          {topics.length === 0 && !showNewTopicForm && (
            <div className="text-center py-12 bg-zinc-800/30 rounded-xl border border-zinc-800">
              <MessageCircle className="mx-auto text-zinc-600 mb-4" size={48} />
              <p className="text-zinc-400 mb-4">No discussions yet. Be the first to start one!</p>
              <button
                onClick={handleStartDiscussion}
                className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 mx-auto transition-colors"
                data-testid="button-start-discussion"
              >
                <Plus size={18} />
                Start a Discussion
              </button>
            </div>
          )}

          {(topics.length > 0 || showNewTopicForm) && (
            <div className="space-y-4">
              {!showNewTopicForm && (
                <button
                  onClick={handleStartDiscussion}
                  className="w-full border border-dashed border-zinc-700 hover:border-amber-500/50 text-zinc-400 hover:text-amber-500 py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  data-testid="button-new-topic"
                >
                  <Plus size={18} />
                  Start a New Discussion
                </button>
              )}

              <AnimatePresence>
                {showNewTopicForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4"
                  >
                    <textarea
                      value={newTopicPrompt}
                      onChange={(e) => setNewTopicPrompt(e.target.value)}
                      placeholder="What would you like to discuss? (e.g., 'What did the ending really mean?')"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                      rows={3}
                      data-testid="input-topic-prompt"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => setShowNewTopicForm(false)}
                        className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                        data-testid="button-cancel-topic"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateTopic}
                        disabled={createTopicMutation.isPending || newTopicPrompt.length < 5}
                        className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        data-testid="button-submit-topic"
                      >
                        {createTopicMutation.isPending ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          'Post Discussion'
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {topics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  isSelected={selectedTopic === topic.id}
                  onSelect={() => setSelectedTopic(selectedTopic === topic.id ? null : topic.id)}
                  onLoginRequired={onLoginRequired}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface TopicCardProps {
  topic: DiscussionTopic;
  isSelected: boolean;
  onSelect: () => void;
  onLoginRequired: () => void;
}

function TopicCard({ topic, isSelected, onSelect, onLoginRequired }: TopicCardProps) {
  return (
    <motion.div
      layout
      className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden"
    >
      <button
        onClick={onSelect}
        className="w-full px-5 py-4 text-left flex items-start justify-between hover:bg-zinc-800/70 transition-colors"
        data-testid={`button-topic-${topic.id}`}
      >
        <div className="flex-1">
          <p className="text-white font-medium">{topic.prompt}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDistanceToNow(new Date(topic.lastActivityAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isSelected ? 180 : 0 }}
          className="text-zinc-400 ml-3"
        >
          <ChevronUp size={20} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TopicPosts topicId={topic.id} onLoginRequired={onLoginRequired} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface TopicPostsProps {
  topicId: string;
  onLoginRequired: () => void;
}

function TopicPosts({ topicId, onLoginRequired }: TopicPostsProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [newPostBody, setNewPostBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: () => getTopicWithPosts(topicId),
    refetchInterval: 5000,
  });

  const createPostMutation = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: string }) =>
      createPost(topicId, body, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
      setNewPostBody('');
      setReplyTo(null);
    },
  });

  const handlePost = (parentId?: string) => {
    if (!isAuthenticated) {
      onLoginRequired();
      return;
    }
    if (!newPostBody.trim()) return;
    createPostMutation.mutate({ body: newPostBody.trim(), parentId });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8 border-t border-zinc-700">
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  const posts = data?.posts || [];
  const rootPosts = posts.filter(p => !p.parentPostId);

  const buildThread = (parentId: string | null, depth: number = 0): DiscussionPost[] => {
    return posts
      .filter(p => p.parentPostId === parentId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  return (
    <div className="border-t border-zinc-700 px-5 py-4">
      {posts.length === 0 ? (
        <p className="text-zinc-500 text-center py-4">No replies yet. Be the first!</p>
      ) : (
        <div className="space-y-4 mb-4">
          {rootPosts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              allPosts={posts}
              onReply={(id) => {
                if (!isAuthenticated) {
                  onLoginRequired();
                  return;
                }
                setReplyTo(id);
              }}
              replyTo={replyTo}
              onLoginRequired={onLoginRequired}
            />
          ))}
        </div>
      )}

      <div className="mt-4">
        <textarea
          value={newPostBody}
          onChange={(e) => setNewPostBody(e.target.value)}
          placeholder={isAuthenticated ? "Share your thoughts..." : "Sign in to join the discussion"}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
          rows={2}
          disabled={!isAuthenticated}
          data-testid="input-post-body"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => handlePost(replyTo || undefined)}
            disabled={createPostMutation.isPending || !newPostBody.trim()}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            data-testid="button-submit-post"
          >
            {createPostMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              replyTo ? 'Reply' : 'Post'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PostItemProps {
  post: DiscussionPost;
  allPosts: DiscussionPost[];
  onReply: (postId: string) => void;
  replyTo: string | null;
  onLoginRequired: () => void;
  depth?: number;
}

function PostItem({ post, allPosts, onReply, replyTo, onLoginRequired, depth = 0 }: PostItemProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [localVoted, setLocalVoted] = useState(post.userVoted);
  const [localCount, setLocalCount] = useState(post.voteCount);

  useEffect(() => {
    setLocalVoted(post.userVoted);
    setLocalCount(post.voteCount);
  }, [post.userVoted, post.voteCount]);

  const voteMutation = useMutation({
    mutationFn: () => toggleVote(post.id),
    onMutate: () => {
      setLocalVoted(!localVoted);
      setLocalCount(localVoted ? localCount - 1 : localCount + 1);
    },
    onSuccess: (result) => {
      setLocalVoted(result.voted);
      setLocalCount(result.newCount);
    },
    onError: () => {
      setLocalVoted(post.userVoted);
      setLocalCount(post.voteCount);
    },
  });

  const handleVote = () => {
    if (!isAuthenticated) {
      onLoginRequired();
      return;
    }
    voteMutation.mutate();
  };

  const replies = allPosts.filter(p => p.parentPostId === post.id);
  const maxDepth = 3;

  return (
    <div className={`${depth > 0 ? 'ml-4 pl-4 border-l border-zinc-700' : ''}`}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <button
            onClick={handleVote}
            className={`p-1.5 rounded hover:bg-zinc-700 transition-colors ${
              localVoted ? 'text-amber-500' : 'text-zinc-400 hover:text-white'
            }`}
            data-testid={`button-vote-${post.id}`}
          >
            <ChevronUp size={18} />
          </button>
          <span className={`text-sm font-medium ${localVoted ? 'text-amber-500' : 'text-zinc-400'}`}>
            {localCount}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white font-medium">{post.authorName}</span>
            <span className="text-zinc-500">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-zinc-300 mt-1 whitespace-pre-wrap">{post.body}</p>
          {depth < maxDepth && (
            <button
              onClick={() => onReply(post.id)}
              className={`text-sm mt-2 flex items-center gap-1 transition-colors ${
                replyTo === post.id ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              data-testid={`button-reply-${post.id}`}
            >
              <Reply size={14} />
              Reply
            </button>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map(reply => (
            <PostItem
              key={reply.id}
              post={reply}
              allPosts={allPosts}
              onReply={onReply}
              replyTo={replyTo}
              onLoginRequired={onLoginRequired}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
