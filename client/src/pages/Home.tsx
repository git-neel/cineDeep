import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MovieCard } from "@/components/MovieCard";

export default function Home() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="p-6 flex justify-between items-center z-10">
        <h1 className="text-2xl font-display font-bold tracking-tighter">CineDeep</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-[100px] -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px] -z-10" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-2xl text-center space-y-8"
        >
          <div className="space-y-4">
            <h2 className="text-5xl md:text-7xl font-display font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
              Decode Cinema.
            </h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Discover hidden meanings, financial analytics, and deep insights for your favorite movies and shows.
            </p>
          </div>

          <form onSubmit={handleSearch} className="relative w-full max-w-lg mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative flex items-center bg-background/80 backdrop-blur-xl border border-white/10 rounded-full px-4 h-14 shadow-2xl transition-all group-hover:border-white/20">
                <Search className="w-5 h-5 text-muted-foreground ml-2" />
                <Input 
                  type="text" 
                  placeholder="Search movies, shows, dialogues..." 
                  className="flex-1 border-0 bg-transparent h-full text-lg placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 px-4"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  className="rounded-full px-6 bg-white text-black hover:bg-white/90 font-medium"
                >
                  Search
                </Button>
              </div>
            </div>
          </form>

          <div className="pt-20 text-center w-full max-w-lg">
            <p className="text-sm text-muted-foreground">
              Try searching for "Inception", "Breaking Bad", "The Dark Knight", or any movie or show you love
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
