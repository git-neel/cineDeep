export interface Actor {
  id: string;
  name: string;
  role: string;
  fee: string;
  currentProjects: string[];
  imageUrl?: string;
}

export interface HiddenDetail {
  id: string;
  type: 'dialogue' | 'metaphor' | 'easter-egg';
  title: string; // The dialogue or the scene name
  description: string;
}

export interface Movie {
  id: string;
  title: string;
  type: 'Movie' | 'Show' | 'Documentary';
  year: string;
  synopsis: string;
  posterUrl: string;
  backdropUrl: string;
  director: {
    name: string;
    fee: string;
    currentProjects: string[];
  };
  cast: Actor[];
  budget: {
    production: string;
    boxOffice: string;
    verdict: 'Blockbuster' | 'Super Hit' | 'Hit' | 'Average' | 'Flop' | 'Super Flop' | 'Disaster';
  };
  deepDive: HiddenDetail[];
}

export const mockMovies: Movie[] = [
  {
    id: '1',
    title: 'Inception',
    type: 'Movie',
    year: '2010',
    synopsis: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
    posterUrl: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1000&auto=format&fit=crop', // Abstract building placeholder
    backdropUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2000&auto=format&fit=crop',
    director: {
      name: 'Christopher Nolan',
      fee: '$20M + 20% Gross',
      currentProjects: ['Oppenheimer (Completed)', 'Untitled 2026 Project']
    },
    cast: [
      {
        id: 'c1',
        name: 'Leonardo DiCaprio',
        role: 'Cobb',
        fee: '$59M (inc. points)',
        currentProjects: ['Killers of the Flower Moon (Completed)', 'The Wager']
      },
      {
        id: 'c2',
        name: 'Joseph Gordon-Levitt',
        role: 'Arthur',
        fee: '$5M',
        currentProjects: ['Beverly Hills Cop: Axel F', 'Poker Face']
      },
      {
        id: 'c3',
        name: 'Elliot Page',
        role: 'Ariadne',
        fee: '$2M',
        currentProjects: ['The Umbrella Academy']
      }
    ],
    budget: {
      production: '$160,000,000',
      boxOffice: '$837,186,610',
      verdict: 'Blockbuster'
    },
    deepDive: [
      {
        id: 'd1',
        type: 'metaphor',
        title: 'The Spinning Top',
        description: 'The top represents the fragility of reality. Whether it falls or not is irrelevant; Cobb walking away signifies he no longer cares about distinguishing the dream from reality, he chooses his children.'
      },
      {
        id: 'd2',
        type: 'dialogue',
        title: '"You mustn\'t be afraid to dream a little bigger, darling."',
        description: 'Eames says this before pulling out a grenade launcher. It is a meta-commentary on the power of imagination and cinema itself—why constrain yourself to realistic limitations when you can manipulate the world?'
      }
    ]
  },
  {
    id: '2',
    title: 'Succession',
    type: 'Show',
    year: '2018-2023',
    synopsis: 'The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their father steps down from the company.',
    posterUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1000&auto=format&fit=crop', // Business placeholder
    backdropUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2000&auto=format&fit=crop',
    director: {
      name: 'Jesse Armstrong (Creator)',
      fee: '$5M/Season',
      currentProjects: ['Unknown']
    },
    cast: [
      {
        id: 'c4',
        name: 'Brian Cox',
        role: 'Logan Roy',
        fee: '$500k/episode',
        currentProjects: ['007: Road to a Million', 'The Lord of the Rings: The War of the Rohirrim']
      },
      {
        id: 'c5',
        name: 'Jeremy Strong',
        role: 'Kendall Roy',
        fee: '$350k/episode',
        currentProjects: ['The Apprentice']
      }
    ],
    budget: {
      production: '$90M / Season',
      boxOffice: 'N/A (TV)',
      verdict: 'Super Hit'
    },
    deepDive: [
      {
        id: 'd3',
        type: 'metaphor',
        title: 'Water Imagery',
        description: 'Water is consistently used to represent Kendall’s emotional state—drowning, baptism, or being overwhelmed. It appears in key moments of his downfall and attempted rebirths.'
      },
      {
        id: 'd4',
        type: 'easter-egg',
        title: 'Meal Fit for a King',
        description: 'The food served in scenes is often barely touched, symbolizing the family’s gluttony for power rather than sustenance. It represents consumption without satisfaction.'
      }
    ]
  },
  {
    id: '3',
    title: 'Interstellar',
    type: 'Movie',
    year: '2014',
    synopsis: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
    posterUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=2000&auto=format&fit=crop',
    director: {
      name: 'Christopher Nolan',
      fee: '$20M + Points',
      currentProjects: ['Oppenheimer (Completed)']
    },
    cast: [
      {
        id: 'c6',
        name: 'Matthew McConaughey',
        role: 'Cooper',
        fee: '$15M',
        currentProjects: ['Deadpool & Wolverine (Cameo rumored)', 'The Rivals of Amziah King']
      },
      {
        id: 'c7',
        name: 'Anne Hathaway',
        role: 'Brand',
        fee: '$10M',
        currentProjects: ['The Idea of You', 'Mothers\' Instinct']
      }
    ],
    budget: {
      production: '$165,000,000',
      boxOffice: '$701,729,206',
      verdict: 'Hit'
    },
    deepDive: [
      {
        id: 'd5',
        type: 'dialogue',
        title: '"Love is the one thing we\'re capable of perceiving that transcends dimensions of time and space."',
        description: 'Brand’s monologue is the thematic core of the film. It argues that love isn’t just a biological drive but a tangible force in the universe, as real as gravity.'
      }
    ]
  }
];

export const searchContent = (query: string): Movie[] => {
  const q = query.toLowerCase();
  if (!q) return [];
  return mockMovies.filter(movie => 
    movie.title.toLowerCase().includes(q) || 
    movie.synopsis.toLowerCase().includes(q) ||
    movie.cast.some(actor => actor.name.toLowerCase().includes(q))
  );
};

export const getMovieById = (id: string): Movie | undefined => {
  return mockMovies.find(m => m.id === id);
};
