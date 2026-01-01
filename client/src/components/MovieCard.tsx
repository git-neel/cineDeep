import { Link } from "wouter";
import { Movie } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const titleSlug = `${movie.type.toLowerCase()}/${movie.id}`;
  
  return (
    <Link href={`/title/${titleSlug}`} data-testid={`link-movie-${movie.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="cursor-pointer group"
      >
        <Card className="border-0 bg-transparent overflow-hidden rounded-lg shadow-none">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
            <img 
              src={movie.posterUrl} 
              alt={movie.title}
              className="object-cover w-full h-full transition-all duration-500 group-hover:opacity-80 group-hover:scale-105"
            />
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="backdrop-blur-md bg-black/50 text-white border-0">
                {movie.type}
              </Badge>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <p className="text-white text-sm font-medium line-clamp-2">
                {movie.synopsis}
              </p>
            </div>
          </div>
          <CardContent className="p-3 pl-0">
            <h3 className="font-display font-bold text-lg leading-tight text-foreground group-hover:text-primary transition-colors" data-testid={`text-title-${movie.id}`}>
              {movie.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-year-${movie.id}`}>
              {movie.year}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
