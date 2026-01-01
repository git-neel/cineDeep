import { useRoute, useLocation } from "wouter";
import { getMovieById } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, DollarSign, Film, Sparkles, MessageSquare, Quote, Clapperboard } from "lucide-react";
import { motion } from "framer-motion";

export default function MovieDetail() {
  const [match, params] = useRoute("/title/:id");
  const [, setLocation] = useLocation();
  const id = params?.id;
  const movie = id ? getMovieById(id) : undefined;

  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-display font-bold">404</h1>
          <p className="text-muted-foreground">Title not found</p>
          <Button onClick={() => setLocation("/")} variant="outline">Go Home</Button>
        </div>
      </div>
    );
  }

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'Blockbuster': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'Super Hit': return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'Hit': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Average': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'Flop': return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'Disaster': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Hero Header with Backdrop */}
      <div className="relative h-[60vh] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={movie.backdropUrl} 
            alt="Backdrop" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        <div className="absolute top-0 left-0 w-full p-6 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/")}
            className="rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md text-white border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-end">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden md:block w-48 lg:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-white/10 shrink-0"
            >
              <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
            </motion.div>
            
            <div className="flex-1 space-y-4 mb-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="bg-white/5 border-white/20 text-white backdrop-blur-md">
                    {movie.type}
                  </Badge>
                  <span className="text-white/60 font-medium">{movie.year}</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-display font-bold text-white tracking-tight">
                  {movie.title}
                </h1>
              </motion.div>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-white/80 max-w-2xl leading-relaxed"
              >
                {movie.synopsis}
              </motion.p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 mt-12 space-y-16">
        
        {/* Financials & Director */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-card border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Production Budget</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{movie.budget.production}</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-card border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Film className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Lifetime Collection</span>
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{movie.budget.boxOffice}</p>
            </div>

            <div className={`p-6 rounded-2xl border space-y-2 ${getVerdictColor(movie.budget.verdict)}`}>
              <div className="flex items-center gap-2 mb-2 opacity-80">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Verdict</span>
              </div>
              <p className="text-2xl font-display font-bold">{movie.budget.verdict}</p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clapperboard className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Director</span>
              </div>
              <p className="text-xl font-display font-bold text-foreground">{movie.director.name}</p>
              <div className="flex justify-between items-end mt-2">
                <span className="text-sm text-muted-foreground">Fee: {movie.director.fee}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Cast & Crew */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-display font-bold">Cast & Salaries</h2>
          </div>
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex gap-6">
              {movie.cast.map((actor) => (
                <div key={actor.id} className="w-[280px] p-6 rounded-2xl bg-card border border-white/5 shrink-0 hover:bg-white/5 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold font-display">
                      {actor.name.charAt(0)}
                    </div>
                    <Badge variant="secondary" className="bg-white/5 hover:bg-white/10">
                      {actor.fee}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-1 truncate">{actor.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4 truncate">as {actor.role}</p>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current Projects</p>
                    <div className="flex flex-wrap gap-2">
                      {actor.currentProjects.map((project, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/5">
                          {project}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>

        {/* Deep Dive / Hidden Meanings */}
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-3xl -z-10 blur-3xl" />
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <h2 className="text-3xl font-display font-bold">Deep Dive & Hidden Meanings</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {movie.deepDive.map((item) => (
              <div key={item.id} className="group p-8 rounded-2xl bg-card border border-white/5 hover:border-white/20 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  {item.type === 'dialogue' && <Quote className="w-5 h-5 text-blue-400" />}
                  {item.type === 'metaphor' && <MessageSquare className="w-5 h-5 text-purple-400" />}
                  {item.type === 'easter-egg' && <Sparkles className="w-5 h-5 text-yellow-400" />}
                  <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{item.type}</span>
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
