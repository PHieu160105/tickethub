<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>TicketRush | My Profile Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;900&amp;family=Be+Vietnam+Pro:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "secondary": "#f0c03e",
                    "surface-container-high": "#242842",
                    "primary-container": "#fc536d",
                    "on-secondary-fixed": "#251a00",
                    "surface-container-highest": "#2f334e",
                    "on-primary": "#67001c",
                    "on-primary-fixed-variant": "#91002b",
                    "surface-dim": "#0d112a",
                    "on-tertiary-fixed-variant": "#274774",
                    "background": "#0d112a",
                    "inverse-on-surface": "#2b2f49",
                    "on-error-container": "#ffdad6",
                    "surface-variant": "#2f334e",
                    "on-primary-container": "#5b0017",
                    "on-secondary": "#3e2e00",
                    "on-error": "#690005",
                    "tertiary-fixed-dim": "#a9c8fc",
                    "secondary-fixed-dim": "#f0c03e",
                    "on-tertiary-fixed": "#001b3c",
                    "on-surface": "#dee0ff",
                    "tertiary-fixed": "#d5e3ff",
                    "on-primary-fixed": "#40000e",
                    "on-tertiary": "#09305c",
                    "surface-container": "#1a1e37",
                    "inverse-surface": "#dee0ff",
                    "tertiary": "#a9c8fc",
                    "outline": "#a9898a",
                    "tertiary-container": "#7392c3",
                    "error": "#ffb4ab",
                    "primary-fixed-dim": "#ffb2b7",
                    "surface-tint": "#ffb2b7",
                    "inverse-primary": "#b71d3f",
                    "secondary-fixed": "#ffdf95",
                    "on-secondary-fixed-variant": "#594400",
                    "on-background": "#dee0ff",
                    "surface": "#0d112a",
                    "on-surface-variant": "#e2bebf",
                    "on-tertiary-container": "#002a55",
                    "secondary-container": "#ba9000",
                    "surface-container-lowest": "#080c25",
                    "outline-variant": "#5a4042",
                    "error-container": "#93000a",
                    "on-secondary-container": "#3c2c00",
                    "surface-container-low": "#161a33",
                    "surface-bright": "#343752",
                    "primary-fixed": "#ffdadb",
                    "primary": "#ffb2b7"
            },
            "borderRadius": {
                    "DEFAULT": "0.125rem",
                    "lg": "0.25rem",
                    "xl": "0.5rem",
                    "full": "0.75rem"
            },
            "fontFamily": {
                    "headline": ["Space Grotesk"],
                    "body": ["Be Vietnam Pro"],
                    "label": ["Space Grotesk"]
            }
          },
        },
      }
    </script>
<style>
        body {
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            color: #dee0ff;
            font-family: 'Be Vietnam Pro', sans-serif;
            min-height: 100vh;
        }
        .glass-panel {
            background: rgba(26, 30, 55, 0.8);
            backdrop-filter: blur(12px) saturate(180%);
            border-top: 1px solid rgba(255, 178, 183, 0.2);
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .text-glow-red {
            text-shadow: 0 0 15px rgba(252, 83, 109, 0.4);
        }
    </style>
</head>
<body class="selection:bg-primary-container selection:text-on-primary-container">
<!-- TopNavBar -->
<header class="bg-slate-950/80 backdrop-blur-xl docked full-width top-0 sticky z-50 border-b border-white/10 shadow-[0_0_15px_rgba(233,69,96,0.2)]">
<div class="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
<div class="text-2xl font-black italic tracking-tighter text-red-500 uppercase font-headline">
                TicketRush
            </div>
<nav class="hidden md:flex items-center gap-8 font-headline font-bold tracking-tight">
<a class="text-slate-300 hover:text-white transition-colors" href="#">Events</a>
<a class="text-slate-300 hover:text-white transition-colors" href="#">Venues</a>
<a class="text-slate-300 hover:text-white transition-colors" href="#">Deals</a>
<a class="text-red-500 border-b-2 border-red-500 pb-1" href="#">My Tickets</a>
</nav>
<div class="flex items-center gap-4">
<div class="relative hidden lg:block">
<input class="bg-surface-container-highest/50 border-none rounded-full px-4 py-1.5 text-sm focus:ring-1 focus:ring-primary w-64 text-on-surface-variant" placeholder="Search events..." type="text"/>
</div>
<button class="text-slate-300 hover:bg-white/5 p-2 rounded-full transition-all duration-300 active:scale-90">
<span class="material-symbols-outlined">notifications</span>
</button>
<button class="text-slate-300 hover:bg-white/5 p-2 rounded-full transition-all duration-300 active:scale-90">
<span class="material-symbols-outlined">shopping_cart</span>
</button>
<div class="w-10 h-10 rounded-full border-2 border-primary overflow-hidden">
<img alt="User profile" class="w-full h-full object-cover" data-alt="close-up portrait of a stylish young man with a confident expression in cinematic low light photography" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBpVFotIOM_CAG3j95-kR8iwtagTj5T-IL7EeB2SdQbm49bD1SSMFHNOO1Z_C-aL5QDMrjgGRuYRz02i9sdycdLW0MesoYUUhg_uv7e2b4KZYWM78g-vboMzD7QK_uQRu6ulvka3SaD-7uLhws8GScHPW2pqnCPC6fP20hawTpqeOKd3tDfPsATini3T3iZ-5EB27IjnNbW2DZM9399QdWVA_kLgQMOQq_jAFbYJY5B2W-CByjn9wKUXIGtzU4hsKV8zOYtmRriPs"/>
</div>
</div>
</div>
</header>
<div class="max-w-screen-2xl mx-auto flex flex-col md:flex-row min-h-[calc(100vh-80px)]">
<!-- Sidebar Navigation -->
<aside class="w-full md:w-72 glass-panel border-r border-white/5 p-6 space-y-8">
<div class="space-y-2">
<p class="font-label text-[10px] tracking-[0.2em] uppercase text-slate-500 px-4">Account</p>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-container/10 text-primary-fixed-dim border border-primary/20" href="#">
<span class="material-symbols-outlined">person</span>
<span class="font-headline font-bold text-sm tracking-tight">My Profile</span>
</a>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined">confirmation_number</span>
<span class="font-headline font-bold text-sm tracking-tight">My Tickets</span>
</a>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined">favorite</span>
<span class="font-headline font-bold text-sm tracking-tight">Favorites</span>
</a>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined">history</span>
<span class="font-headline font-bold text-sm tracking-tight">History</span>
</a>
</div>
<div class="space-y-2">
<p class="font-label text-[10px] tracking-[0.2em] uppercase text-slate-500 px-4">Support</p>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined">help</span>
<span class="font-headline font-bold text-sm tracking-tight">Help Center</span>
</a>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 transition-all" href="#">
<span class="material-symbols-outlined">logout</span>
<span class="font-headline font-bold text-sm tracking-tight">Sign Out</span>
</a>
</div>
</aside>
<!-- Main Content -->
<main class="flex-1 p-6 md:p-10 space-y-12 overflow-x-hidden">
<!-- Profile Header -->
<section class="relative">
<div class="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
<div class="flex flex-col md:flex-row items-center gap-8 relative z-10">
<div class="relative group">
<div class="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-surface-container-highest overflow-hidden shadow-2xl">
<img alt="User avatar" class="w-full h-full object-cover" data-alt="professional studio headshot of a person with dark hair and thoughtful expression against a moody blue background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmdg28w6ZpSQFRFip_k58b_uYURDtOmdcNmy5seFpybIN8uXii-vgN2cl4nMhx99bwMv4to2C96o6_p5dpKJDXiCgAd3Z0j4ufbOZYXOI5TU5MDdgLP9R-uepkHv4z-hdSZjnbDUoqf2SH1SliISSuvLsFY7frad0AuVyPm6U1JVR1k7r5w0DtHcX84vEWN6ZPy7a2Zz2qWZg0yQ9G-uUNdo9l6-RHjSbr1SsKH2jnxWnK0mCQJ-WxnOw_G2K__vG4GzQddJOodZ4"/>
</div>
<button class="absolute bottom-2 right-2 bg-primary text-on-primary-container p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
<span class="material-symbols-outlined text-sm">edit</span>
</button>
</div>
<div class="text-center md:text-left">
<h1 class="text-4xl md:text-5xl font-headline font-black tracking-tighter mb-2 text-white">MARCUS VOYAGER</h1>
<p class="font-body text-secondary flex items-center justify-center md:justify-start gap-2">
<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">stars</span>
                            Elite Voyager Member since Dec 2022
                        </p>
</div>
</div>
</section>
<!-- Statistics Grid -->
<section class="grid grid-cols-1 sm:grid-cols-3 gap-6">
<div class="glass-panel p-6 rounded-2xl flex flex-col items-center text-center group hover:bg-surface-bright/20 transition-all duration-300">
<span class="material-symbols-outlined text-primary mb-2 text-3xl">payments</span>
<span class="text-3xl font-headline font-black text-white">$4,280</span>
<span class="font-label text-[10px] tracking-widest uppercase text-slate-500 mt-1">Total Spent</span>
</div>
<div class="glass-panel p-6 rounded-2xl flex flex-col items-center text-center group hover:bg-surface-bright/20 transition-all duration-300">
<span class="material-symbols-outlined text-secondary mb-2 text-3xl">celebration</span>
<span class="text-3xl font-headline font-black text-white">24</span>
<span class="font-label text-[10px] tracking-widest uppercase text-slate-500 mt-1">Events Attended</span>
</div>
<div class="glass-panel p-6 rounded-2xl flex flex-col items-center text-center group hover:bg-surface-bright/20 transition-all duration-300">
<span class="material-symbols-outlined text-tertiary mb-2 text-3xl">favorite</span>
<span class="text-3xl font-headline font-black text-white">12</span>
<span class="font-label text-[10px] tracking-widest uppercase text-slate-500 mt-1">Favorite Artists</span>
</div>
</section>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
<!-- Personal Info -->
<section class="lg:col-span-8 glass-panel p-8 rounded-2xl space-y-8">
<div>
<h2 class="text-xl font-headline font-bold text-white mb-6 flex items-center gap-3">
<span class="w-1 h-6 bg-primary rounded-full"></span>
                            Personal Information
                        </h2>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<div class="space-y-2">
<label class="font-label text-[10px] tracking-widest uppercase text-slate-500">Full Name</label>
<input class="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary transition-all" type="text" value="Marcus Voyager"/>
</div>
<div class="space-y-2">
<label class="font-label text-[10px] tracking-widest uppercase text-slate-500">Email Address</label>
<input class="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary transition-all" type="email" value="marcus.v@cosmic.com"/>
</div>
<div class="space-y-2">
<label class="font-label text-[10px] tracking-widest uppercase text-slate-500">Phone Number</label>
<input class="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary transition-all" type="tel" value="+1 (555) 234-5678"/>
</div>
<div class="space-y-2">
<label class="font-label text-[10px] tracking-widest uppercase text-slate-500">Location</label>
<input class="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary transition-all" type="text" value="San Francisco, CA"/>
</div>
</div>
</div>
<div class="pt-6 border-t border-white/5">
<button class="bg-primary text-on-primary-container px-8 py-3 rounded-xl font-headline font-bold uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(233,69,96,0.4)] hover:brightness-110 active:scale-95 transition-all">
                            Update Profile
                        </button>
</div>
</section>
<!-- Preferences & Security Sidebar -->
<div class="lg:col-span-4 space-y-8">
<!-- Preferences -->
<section class="glass-panel p-8 rounded-2xl space-y-6">
<h2 class="text-xl font-headline font-bold text-white flex items-center gap-3">
<span class="w-1 h-6 bg-secondary rounded-full"></span>
                            Preferences
                        </h2>
<div class="space-y-4">
<div class="flex items-center justify-between">
<span class="text-sm font-body text-slate-300">Language</span>
<select class="bg-surface-container-highest border-none rounded-lg text-xs font-headline font-bold py-1 pl-2 pr-8 text-on-surface focus:ring-0">
<option>English (US)</option>
<option>French</option>
<option>Japanese</option>
</select>
</div>
<div class="flex items-center justify-between">
<span class="text-sm font-body text-slate-300">Currency</span>
<select class="bg-surface-container-highest border-none rounded-lg text-xs font-headline font-bold py-1 pl-2 pr-8 text-on-surface focus:ring-0">
<option>USD ($)</option>
<option>EUR (€)</option>
<option>GBP (£)</option>
</select>
</div>
</div>
</section>
<!-- Security -->
<section class="glass-panel p-8 rounded-2xl space-y-6">
<h2 class="text-xl font-headline font-bold text-white flex items-center gap-3">
<span class="w-1 h-6 bg-tertiary rounded-full"></span>
                            Security
                        </h2>
<div class="space-y-4">
<button class="w-full flex items-center justify-between text-left p-3 rounded-xl hover:bg-white/5 transition-colors group">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-slate-500">lock</span>
<span class="text-sm font-body text-slate-300">Change Password</span>
</div>
<span class="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
</button>
<div class="flex items-center justify-between p-3 rounded-xl">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-slate-500">verified_user</span>
<div class="flex flex-col">
<span class="text-sm font-body text-slate-300">Two-Factor Auth</span>
<span class="text-[10px] text-primary">Highly Recommended</span>
</div>
</div>
<div class="relative inline-flex items-center cursor-pointer">
<div class="w-11 h-6 bg-surface-container-highest rounded-full border border-white/10"></div>
<div class="absolute left-1 top-1 bg-slate-400 w-4 h-4 rounded-full transition-transform"></div>
</div>
</div>
</div>
</section>
</div>
</div>
</main>
</div>
<!-- Footer -->
<footer class="bg-slate-950 border-t border-white/5 py-12">
<div class="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
<div class="col-span-2 md:col-span-1 space-y-4">
<div class="text-xl font-black text-red-500 font-headline uppercase">TicketRush</div>
<p class="text-slate-500 text-xs font-headline font-semibold tracking-wide">© 2024 TicketRush. Powered by the Cosmic Voyager.</p>
</div>
<div class="space-y-2">
<p class="font-label text-[10px] tracking-widest uppercase text-slate-400 mb-4">Platform</p>
<a class="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Help Center</a>
<a class="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Sell Tickets</a>
<a class="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Artist Portal</a>
</div>
<div class="space-y-2">
<p class="font-label text-[10px] tracking-widest uppercase text-slate-400 mb-4">Legal</p>
<a class="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Terms of Service</a>
<a class="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Privacy Policy</a>
<a class="block text-slate-500 hover:text-red-400 transition-colors font-label text-xs uppercase" href="#">Affiliates</a>
</div>
<div class="space-y-4">
<p class="font-label text-[10px] tracking-widest uppercase text-slate-400 mb-4">Newsletter</p>
<div class="flex gap-2">
<input class="bg-surface-container-low border-none rounded-lg text-xs w-full" placeholder="Email" type="email"/>
<button class="bg-primary text-on-primary-container p-2 rounded-lg">
<span class="material-symbols-outlined text-sm">send</span>
</button>
</div>
</div>
</div>
</footer>
</body></html>