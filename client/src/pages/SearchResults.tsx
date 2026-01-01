import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { searchMovies, Movie } from "@/lib/api";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SearchResults() {
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query) {
      setLoading(true);
      searchMovies(query)
        .then(setResults)
        .catch((error) => {
          console.error("Search failed:", error);
          setResults([]);
        })
        .finally(() => setLoading(false));
    }
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLocation(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between mb-12">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            className="rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold">CineDeep</h1>
        </div>
        
        <form onSubmit={handleSearch} className="w-full md:max-w-md">
           <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-10 group-hover:opacity-25 transition duration-500"></div>
              <div className="relative flex items-center bg-background/80 backdrop-blur-xl border border-white/10 rounded-full px-4 h-12 shadow-lg transition-all group-hover:border-white/20">
                <Search className="w-4 h-4 text-muted-foreground ml-2" />
                <Input 
                  type="text" 
                  placeholder="Search..." 
                  className="flex-1 border-0 bg-transparent h-full placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 px-4"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
        </form>
      </header>

      <main className="max-w-7xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Searching the depths of cinema...</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-xl text-muted-foreground">
                {results.length > 0 
                  ? `Found ${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`
                  : `No results found for "${query}"`
                }
              </h2>
            </div>

            {results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {results.map(movie => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-display font-bold">Title Not Found in Database</h3>
            <p className="text-muted-foreground max-w-md">
              Our analysis team hasn't covered "{query}" yet. Since this is a prototype, we only have a limited set of movies available.
            </p>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <Button variant="secondary" className="w-full">
                Request Analysis for "{query}"
              </Button>
              <Button variant="outline" onClick={() => setLocation("/")} className="w-full">
                Back to Home
              </Button>
            </div>
            
            <div className="mt-12 pt-12 border-t border-white/10 w-full max-w-2xl">
              <p className="text-sm text-muted-foreground mb-6 uppercase tracking-wider font-medium">Try searching for these available titles:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {["Inception", "Succession", "Interstellar", "The Dark Knight", "Parasite", "Breaking Bad"].map((title) => (
                  <Button 
                    key={title} 
                    variant="ghost" 
                    className="bg-white/5 hover:bg-white/10 rounded-full text-sm"
                    onClick={() => {
                      setQuery(title);
                      setLocation(`/search?q=${encodeURIComponent(title)}`);
                    }}
                  >
                    {title}
                  </Button>
                ))}
              </div>
            </div>
          </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
