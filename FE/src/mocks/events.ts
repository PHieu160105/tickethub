export interface EventDetail {
  id: number
  title: string
  category: string
  rating: number
  reviewCount: number
  image: string
  description: string
  upcomingEvents: UpcomingEvent[]
  reviews: Review[]
  relatedArtists: RelatedArtist[]
}

export interface UpcomingEvent {
  id: number
  date: string
  day: string
  time: string
  venue: string
  location: string
  tour: string
  available: boolean
}

export interface Review {
  id: number
  rating: number
  title: string
  author: string
  date: string
  venue: string
  content: string
}

export interface RelatedArtist {
  id: number
  name: string
  image: string
}

export const EVENT_DETAILS: EventDetail[] = [
  {
    id: 1,
    title: "Los Tigres del Norte Tickets",
    category: "World",
    rating: 4.4,
    reviewCount: 824,
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&h=500&fit=crop",
    description: "Los Tigres del Norte is a norteño band from Mexico. The group was started in 1968 by Jorge Hernández, with his brothers and cousins. They are known for their socially conscious lyrics and have won multiple Grammy Awards.",
    upcomingEvents: [
      { id: 1, date: "APR 24", day: "Fri", time: "8:00 PM", venue: "ExtraMile Arena", location: "Boise, ID", tour: "Los Tigres del Norte: Los Tigres del Mundo", available: true },
      { id: 2, date: "APR 25", day: "Sat", time: "8:00 PM", venue: "Delta Center", location: "Salt Lake City, UT", tour: "Los Tigres del Norte", available: true },
      { id: 3, date: "MAY 09", day: "Sat", time: "8:00 PM", venue: "Pipa Event Center", location: "Winterhaven, CA", tour: "Los Tigres del Norte: La Loteria (21+ Event)", available: true },
      { id: 4, date: "MAY 10", day: "Sun", time: "6:00 PM", venue: "Palomar Starlight Theater - Pala Casino", location: "Pala, CA", tour: "Los Tigres del Norte (21 and Older Only)", available: true },
      { id: 5, date: "MAY 29", day: "Fri", time: "8:00 PM", venue: "Chartway Arena at Ted Constant Convocation Center", location: "Norfolk, VA", tour: "Los Tigres del Norte", available: true },
      { id: 6, date: "MAY 30", day: "Sat", time: "8:00 PM", venue: "First Horizon Coliseum", location: "Greensboro, NC", tour: "Los Tigres del Norte: Los Tigres del Mundo", available: true },
      { id: 7, date: "AUG 28", day: "Fri", time: "8:00 PM", venue: "CURE Insurance Arena", location: "Trenton, NJ", tour: "Los Tigres del Norte", available: true },
      { id: 8, date: "AUG 29", day: "Sat", time: "8:00 PM", venue: "Amica Mutual Pavilion", location: "Providence, RI", tour: "Los Tigres del Norte: Los Tigres del Mundo", available: true },
    ],
    reviews: [
      { 
        id: 1, 
        rating: 5, 
        title: "Awesome", 
        author: "NettNett", 
        date: "4/20/26", 
        venue: "Grand Casino Arena - Saint Paul", 
        content: "Had a lot of fun, loved the music, a lot of singing and dancing. Took a lot of videos." 
      },
      { 
        id: 2, 
        rating: 5, 
        title: "Fantastic", 
        author: "Esme", 
        date: "4/20/26", 
        venue: "Grand Casino Arena - Saint Paul", 
        content: "Los Tigres delivered way more than expected. They put on an amazing show. It was fantastic 🎉😋 The venue and staff were great as well!" 
      },
      { 
        id: 3, 
        rating: 3, 
        title: "Good but crowded", 
        author: "MusicLover", 
        date: "4/18/26", 
        venue: "Arena Mexico", 
        content: "Great performance but the venue was very crowded. Sound quality could be better." 
      },
    ],
    relatedArtists: [
      { id: 1, name: "MANÁ", image: "https://images.unsplash.com/photo-1493225255756-d9584f8606e3?w=400&h=300&fit=crop" },
      { id: 2, name: "Banda MS", image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=300&fit=crop" },
      { id: 3, name: "Los Angeles Azules", image: "https://images.unsplash.com/photo-1507838153414-b4b713384ebd?w=400&h=300&fit=crop" },
      { id: 4, name: "Ramon Ayala", image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop" },
      { id: 5, name: "Intocable", image: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=400&h=300&fit=crop" },
      { id: 6, name: "Pepe Aguilar", image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=300&fit=crop" },
      { id: 7, name: "Bronco", image: "https://images.unsplash.com/photo-1459749411177-287ce3276916?w=400&h=300&fit=crop" },
      { id: 8, name: "Romeo Santos", image: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&h=300&fit=crop" },
    ]
  }
]

// Helper function to get event by ID
export const getEventById = (id: number): EventDetail | undefined => {
  return EVENT_DETAILS.find(event => event.id === id)
}