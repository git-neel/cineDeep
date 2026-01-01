import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { searchContent, Movie } from "@/lib/mockData";
import { MovieCard } from "@/components/MovieCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SearchResults() {
  const [location, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Movie[]>([]);

  useEffect(() => {
    if (query) {
      setResults(searchContent(query));
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
        <div className="mb-8">
          <h2 className="text-xl text-muted-foreground">
            {results.length > 0 
              ? `Found ${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`
              : `No results found for "${query}"`
            }
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {results.map(movie => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </main>
    </div>
  );
}
