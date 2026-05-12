export interface Category {
  id: number
  name: string
  iconKey: 'Music' | 'Sports' | 'Comedy' | 'Theater'
  color: string
}

export const CATEGORIES: Category[] = [
  { id: 1, name: "Music", iconKey: "Music", color: "from-purple-500 to-pink-500" },
  { id: 2, name: "Sports", iconKey: "Sports", color: "from-blue-500 to-cyan-500" },
  { id: 3, name: "Comedy", iconKey: "Comedy", color: "from-orange-500 to-yellow-500" },
  { id: 4, name: "Theater", iconKey: "Theater", color: "from-red-500 to-rose-500" }
]