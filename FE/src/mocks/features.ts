export interface FeatureItem {
  title: string
  description: string
  iconKey: 'Star' | 'Ticket' | 'User' | 'Search'
  color: string
  link: string
}

export const FEATURE_ITEMS: FeatureItem[] = [
  {
    title: "VIP Access",
    description: "Combine your ticket with a hotel & save up to 33%",
    iconKey: "Star",
    color: "bg-purple-500",
    link: "/vip"
  },
  {
    title: "Ticket Deals",
    description: "Exclusive offers on selected events",
    iconKey: "Ticket",
    color: "bg-blue-500",
    link: "/deals"
  },
  {
    title: "Your Profile",
    description: "Manage your tickets and preferences",
    iconKey: "User",
    color: "bg-green-500",
    link: "/profile"
  },
  {
    title: "Smart Search",
    description: "Find events faster with AI-powered search",
    iconKey: "Search",
    color: "bg-orange-500",
    link: "/search"
  }
]