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

export async function searchMovies(query: string): Promise<Movie[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Failed to search movies');
  }
  return response.json();
}

export async function getMovieDetails(type: string, id: string): Promise<MovieDetail> {
  const response = await fetch(`/api/title/${type}/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch movie details');
  }
  return response.json();
}
