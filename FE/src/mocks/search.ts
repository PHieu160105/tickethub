export interface SearchResult {
  id: number
  title: string
  date: string
  venue: string
  price: string
  image: string
  category: string
  isFeatured?: boolean
  badge?: string
}

export const SEARCH_RESULTS: SearchResult[] = [
  {
    id: 1,
    title: "NEON DREAM FESTIVAL 2024",
    date: "Oct 24-26",
    venue: "Starlight Arena",
    price: "$129",
    image: "https://images.unsplash.com/photo-1493225255756-d9584f8606e3?w=800&h=600&fit=crop",
    category: "festivals",
    isFeatured: true,
    badge: "Staff Pick"
  },
  {
    id: 2,
    title: "CYBERPUNK BEATS: AFTER DARK",
    date: "Nov 12",
    venue: "The Void Underground",
    price: "$45",
    image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=300&fit=crop",
    category: "music"
  },
  {
    id: 3,
    title: "LUNA SOLA: GALAXY TOUR",
    date: "Nov 15",
    venue: "Grand Nebula Hall",
    price: "$89",
    image: "https://images.unsplash.com/photo-1507838153414-b4b713384ebd?w=400&h=300&fit=crop",
    category: "music"
  },
  {
    id: 4,
    title: "INTERSTELLAR JAZZ SESSIONS",
    date: "Nov 18",
    venue: "Blue Moon Lounge",
    price: "$35",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=300&fit=crop",
    category: "music"
  },
  {
    id: 5,
    title: "SYNTHWAVE SUNDAY: 2099",
    date: "Nov 22",
    venue: "Retro Future Hub",
    price: "$25",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop",
    category: "music"
  },
  {
    id: 6,
    title: "GALACTIC ESPORTS CHAMPIONSHIP",
    date: "Nov 25",
    venue: "Cosmos Stadium",
    price: "$75",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop",
    category: "esports"
  },
  {
    id: 7,
    title: "PULSAR BEATS FESTIVAL",
    date: "Dec 01-03",
    venue: "Orion Zenith Arena",
    price: "$149",
    image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=600&fit=crop",
    category: "festivals",
    badge: "Hot"
  },
  {
    id: 8,
    title: "ACOUSTIC NIGHTS UNDER STARS",
    date: "Dec 05",
    venue: "Starlight Arena",
    price: "$55",
    image: "https://images.unsplash.com/photo-1514525253440-b393452e233e?w=400&h=300&fit=crop",
    category: "music"
  }
]

export const VENUES = [
  "All Venues",
  "Starlight Arena",
  "The Void Underground",
  "Grand Nebula Hall",
  "Blue Moon Lounge",
  "Retro Future Hub",
  "Cosmos Stadium",
  "Orion Zenith Arena"
]

export const CATEGORIE = [
  { key: "music", label: "Music" },
  { key: "festivals", label: "Festivals" },
  { key: "esports", label: "E-Sports" }
]

export const TIMEFRAMES = [
  { key: "tonight", label: "Tonight" },
  { key: "weekend", label: "Weekend" },
  { key: "this-week", label: "This Week" },
  { key: "next-week", label: "Next Week" }
]