// Session management
const SESSION_KEY = 'cinedeep_session';

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_KEY, sessionId);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function getAuthHeaders(): Record<string, string> {
  const sessionId = getSessionId();
  return sessionId ? { 'x-session-id': sessionId } : {};
}

// Movie types
export interface Movie {
  id: string;
  title: string;
  type: 'Movie' | 'Show';
  year: string;
  synopsis: string;
  posterUrl: string;
  backdropUrl: string;
}

export interface Actor {
  id: string;
  name: string;
  role: string;
  imageUrl?: string;
  fee?: string;
  currentProjects?: string[];
}

export interface HiddenDetail {
  id: string;
  type: 'dialogue' | 'metaphor' | 'easter-egg';
  title: string;
  description: string;
}

export interface MovieDetail extends Movie {
  director: {
    name: string;
    fee?: string;
  };
  cast: Actor[];
  budget: {
    production: string;
    boxOffice: string;
    verdict: 'Blockbuster' | 'Super Hit' | 'Hit' | 'Average' | 'Flop' | 'Super Flop' | 'Disaster' | 'N/A';
  };
  deepDive?: HiddenDetail[];
}

// User and auth types
export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  sessionId: string;
  user: User;
}

export interface LoginRequestResponse {
  message: string;
  email: string;
  token: string;
  expiresAt: string;
  isNewUser: boolean;
}

// Discussion types
export interface DiscussionTopic {
  id: string;
  tmdbId: number;
  mediaType: string;
  title: string;
  prompt: string;
  createdBy: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface DiscussionPost {
  id: string;
  topicId: string;
  parentPostId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  depth: number;
  createdAt: string;
  editedAt: string | null;
  voteCount: number;
  userVoted: boolean;
}

// Movie API
export async function searchMovies(query: string): Promise<Movie[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Failed to search movies');
  }
  return response.json();
}

export async function getMovieDetails(type: string, id: string): Promise<MovieDetail> {
  const response = await fetch(`/api/title/${type}/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch movie details');
  }
  return response.json();
}

// Auth API
export async function requestLogin(email: string): Promise<LoginRequestResponse> {
  const response = await fetch('/api/auth/request-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to request login');
  }
  return response.json();
}

export async function verifyToken(token: string, displayName?: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, displayName }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to verify token');
  }
  return response.json();
}

export async function getCurrentUser(): Promise<User | null> {
  const sessionId = getSessionId();
  if (!sessionId) return null;
  
  const response = await fetch('/api/auth/me', {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      return null;
    }
    return null;
  }
  return response.json();
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  clearSession();
}

// Discussion API
export async function getTopics(tmdbId: number, mediaType: string): Promise<DiscussionTopic[]> {
  const response = await fetch(`/api/topics?tmdbId=${tmdbId}&mediaType=${mediaType}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to get topics');
  }
  return response.json();
}

export async function createTopic(data: {
  tmdbId: number;
  mediaType: string;
  title: string;
  prompt: string;
}): Promise<DiscussionTopic> {
  const response = await fetch('/api/topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Failed to create topic');
  }
  return response.json();
}

export async function getTopicWithPosts(topicId: string): Promise<{ topic: DiscussionTopic; posts: DiscussionPost[] }> {
  const response = await fetch(`/api/topics/${topicId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to get topic');
  }
  return response.json();
}

export async function createPost(topicId: string, body: string, parentPostId?: string): Promise<DiscussionPost> {
  const response = await fetch(`/api/topics/${topicId}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ body, parentPostId }),
  });
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Failed to create post');
  }
  return response.json();
}

export async function toggleVote(postId: string): Promise<{ voted: boolean; newCount: number }> {
  const response = await fetch(`/api/posts/${postId}/vote`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Failed to vote');
  }
  return response.json();
}

export async function getPresence(tmdbId: number): Promise<{ count: number }> {
  const response = await fetch(`/api/presence?tmdbId=${tmdbId}`);
  if (!response.ok) {
    return { count: 0 };
  }
  return response.json();
}
