<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>TicketRush | Explore Events</title>
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
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .glass-panel {
            background: rgba(26, 30, 55, 0.8);
            backdrop-filter: blur(12px) saturate(180%);
            border-top: 1px solid rgba(255, 178, 183, 0.2);
        }
        .aurora-glow {
            box-shadow: 0 0 15px rgba(233, 69, 96, 0.3);
        }
        .text-glow-primary {
            text-shadow: 0 0 10px rgba(252, 83, 109, 0.5);
        }
    </style>
</head>
<body class="selection:bg-primary-container selection:text-white">
<!-- TopNavBar -->
<header class="bg-slate-950/80 backdrop-blur-xl docked full-width top-0 sticky z-50 border-b border-white/10 shadow-[0_0_15px_rgba(233,69,96,0.2)]">
<div class="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
<div class="flex items-center gap-8">
<span class="text-2xl font-black italic tracking-tighter text-red-500 uppercase font-headline">TicketRush</span>
<nav class="hidden md:flex items-center gap-6 font-headline font-bold tracking-tight uppercase text-xs">
<a class="text-slate-300 hover:text-white transition-colors" href="#">Events</a>
<a class="text-slate-300 hover:text-white transition-colors" href="#">Venues</a>
<a class="text-slate-300 hover:text-white transition-colors" href="#">Deals</a>
<a class="text-slate-300 hover:text-white transition-colors" href="#">My Tickets</a>
</nav>
</div>
<div class="flex items-center gap-4">
<div class="relative hidden sm:block">
<input class="bg-white/5 border-none rounded-xl px-4 py-2 text-sm w-64 focus:ring-1 focus:ring-primary outline-none transition-all aurora-glow" placeholder="Search events..." type="text"/>
<span class="material-symbols-outlined absolute right-3 top-2 text-slate-400 text-sm">search</span>
</div>
<div class="flex items-center gap-3">
<button class="p-2 hover:bg-white/5 transition-all duration-300 rounded-full scale-95 active:scale-90 transition-transform">
<span class="material-symbols-outlined text-slate-300">notifications</span>
</button>
<button class="p-2 hover:bg-white/5 transition-all duration-300 rounded-full scale-95 active:scale-90 transition-transform">
<span class="material-symbols-outlined text-slate-300">shopping_cart</span>
</button>
<div class="w-8 h-8 rounded-full overflow-hidden border border-white/20">
<img alt="User profile" class="w-full h-full object-cover" data-alt="Close up portrait of a professional man with clean lighting and neutral background for profile avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNLANNe1GQjsZgk4GlM0HnvZ_SNvN8bViZOPAfS0HiZLSTW_KNC7VUx8G6V7GCMht0xTTJiUREEcWCKj59sbQNedIRUICm6IDYLMuEZSaBk9MG2ORno3XGe4zn8k55FkltXHjQh1ZROlrB3o8RFAWozAN3-FUTMeyVtqq9eNjMgwkuiPT7Gt9j-GEmldPG3jqw5_6FrkfmLYhvRnWt2m2FO5SdNmZzeuk9iCPntTN_FlfRmkwsAzB7hti3lisMvdIV6d3WKw_13bM"/>
</div>
</div>
</div>
</div>
</header>
<main class="max-w-screen-2xl mx-auto px-6 py-12">
<!-- Prominent Search Bar Section -->
<div class="mb-16 max-w-3xl mx-auto text-center">
<h1 class="text-4xl md:text-5xl font-headline font-black tracking-tighter mb-6 text-glow-primary">FIND YOUR RUSH</h1>
<div class="relative group">
<div class="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
<div class="relative flex items-center bg-surface-container-low rounded-xl p-2 border border-outline-variant/20">
<span class="material-symbols-outlined ml-4 text-primary">search</span>
<input class="bg-transparent border-none focus:ring-0 w-full px-4 py-3 text-lg font-body" placeholder="Search by artist, venue, or event..." type="text" value="Neon Dream Festival 2024"/>
<button class="bg-primary-container text-on-primary-container font-headline font-bold uppercase tracking-widest px-8 py-3 rounded-lg hover:scale-105 active:scale-95 transition-all">
                        Search
                    </button>
</div>
</div>
</div>
<div class="flex flex-col md:flex-row gap-10">
<!-- Filter Sidebar -->
<aside class="w-full md:w-72 shrink-0 space-y-8">
<div class="glass-panel p-6 rounded-xl">
<div class="flex items-center justify-between mb-6">
<h3 class="font-headline font-bold uppercase tracking-widest text-sm text-secondary">Filters</h3>
<button class="text-xs text-slate-400 hover:text-primary transition-colors">Reset All</button>
</div>
<!-- Categories -->
<div class="mb-8">
<p class="text-xs font-headline font-bold uppercase tracking-widest text-slate-400 mb-4">Categories</p>
<div class="space-y-3">
<label class="flex items-center gap-3 cursor-pointer group">
<div class="w-5 h-5 rounded border border-outline-variant/50 flex items-center justify-center group-hover:border-primary transition-colors bg-surface-container-highest">
<div class="w-2 h-2 bg-primary rounded-sm opacity-0 group-hover:opacity-40"></div>
</div>
<span class="text-sm font-body text-on-surface">Music</span>
</label>
<label class="flex items-center gap-3 cursor-pointer group">
<div class="w-5 h-5 rounded border border-primary flex items-center justify-center bg-primary/20">
<span class="material-symbols-outlined text-[14px] text-primary" style="font-variation-settings: 'FILL' 1;">check</span>
</div>
<span class="text-sm font-body text-primary">Festivals</span>
</label>
<label class="flex items-center gap-3 cursor-pointer group">
<div class="w-5 h-5 rounded border border-outline-variant/50 flex items-center justify-center group-hover:border-primary transition-colors bg-surface-container-highest"></div>
<span class="text-sm font-body text-on-surface">E-Sports</span>
</label>
</div>
</div>
<!-- Date Range -->
<div class="mb-8">
<p class="text-xs font-headline font-bold uppercase tracking-widest text-slate-400 mb-4">Timeframe</p>
<div class="grid grid-cols-2 gap-2">
<button class="text-[10px] py-2 border border-outline-variant/30 rounded bg-white/5 font-headline font-semibold uppercase tracking-tighter">Tonight</button>
<button class="text-[10px] py-2 border border-primary/50 rounded bg-primary/10 text-primary font-headline font-semibold uppercase tracking-tighter">Weekend</button>
<button class="text-[10px] py-2 border border-outline-variant/30 rounded bg-white/5 font-headline font-semibold uppercase tracking-tighter col-span-2">Select Date</button>
</div>
</div>
<!-- Price Slider -->
<div class="mb-8">
<p class="text-xs font-headline font-bold uppercase tracking-widest text-slate-400 mb-4">Price Range</p>
<div class="relative h-1 bg-surface-container-highest rounded-full mb-4">
<div class="absolute left-1/4 right-1/4 h-full bg-primary"></div>
<div class="absolute left-1/4 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary border-2 border-white rounded-full cursor-pointer"></div>
<div class="absolute right-1/4 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary border-2 border-white rounded-full cursor-pointer"></div>
</div>
<div class="flex justify-between text-xs font-headline font-medium">
<span>$40</span>
<span>$450+</span>
</div>
</div>
<!-- Venue -->
<div>
<p class="text-xs font-headline font-bold uppercase tracking-widest text-slate-400 mb-4">Venue</p>
<select class="w-full bg-surface-container-highest border-none rounded-lg text-sm p-3 focus:ring-1 focus:ring-primary">
<option>All Venues</option>
<option>Starlight Arena</option>
<option>The Void Club</option>
<option>Cosmos Stadium</option>
</select>
</div>
</div>
<div class="glass-panel p-6 rounded-xl relative overflow-hidden">
<div class="relative z-10">
<p class="text-secondary font-headline font-black text-xl mb-2">GOLDEN PASS</p>
<p class="text-xs text-slate-400 mb-4">Access to all venue VIP lounges for one monthly price.</p>
<button class="text-[10px] font-headline font-bold tracking-widest uppercase border border-secondary text-secondary px-4 py-2 rounded hover:bg-secondary hover:text-on-secondary transition-all">Learn More</button>
</div>
<div class="absolute -right-4 -bottom-4 w-24 h-24 bg-secondary/10 rounded-full blur-2xl"></div>
</div>
</aside>
<!-- Results Grid -->
<div class="flex-1">
<div class="flex items-center justify-between mb-8">
<div class="flex items-baseline gap-3">
<h2 class="text-2xl font-headline font-bold">Found 24 events</h2>
<span class="text-sm text-slate-400 italic">for "Neon Dream"</span>
</div>
<div class="flex items-center gap-2">
<span class="text-xs font-headline font-bold uppercase tracking-widest text-slate-500">Sort By:</span>
<button class="text-sm font-semibold flex items-center gap-1 hover:text-primary transition-colors">
                            Recommended <span class="material-symbols-outlined text-sm">expand_more</span>
</button>
</div>
</div>
<!-- Bento-ish Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
<!-- Featured Large Card -->
<div class="md:col-span-2 lg:col-span-2 group relative h-80 rounded-xl overflow-hidden glass-panel border-none">
<img alt="Music Festival" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60" data-alt="Vibrant outdoor music festival at night with purple and pink laser lights, silhouettes of a cheering crowd, and dramatic lens flares" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8lF7tHa8grkKZUcffQjf220e191Yds9uogkNKBZp8nCgyyFDgxCwWr3LMnQy36rZe9jfP2JdfrrV6NtbMlXWukHaWDZkCq1nvo1SKjiPvZpoV2dmA3l-xpTvQ4WIJFUyEJRrGp3U1MZr0eO4_MzMQbKOiUBfaBOonSHBuzLEfU3UOYLs86W9VegFgcE9rQkmqL9mDweguIp3AkrNs96a_JgOxJRE0G_4lThcRFtM4wxKTafu7kzO_ON6prkyCDewlFc96UTsONjM"/>
<div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
<div class="absolute bottom-0 left-0 p-8 w-full">
<div class="flex justify-between items-end">
<div>
<span class="inline-block px-3 py-1 bg-primary text-on-primary-container text-[10px] font-headline font-black uppercase tracking-[0.2em] rounded mb-3">Staff Pick</span>
<h3 class="text-3xl font-headline font-black tracking-tighter mb-2">NEON DREAM FESTIVAL 2024</h3>
<div class="flex items-center gap-4 text-sm text-slate-300">
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm text-secondary">calendar_today</span> Oct 24-26</span>
<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm text-secondary">location_on</span> Starlight Arena</span>
</div>
</div>
<div class="text-right">
<p class="text-xs font-headline uppercase tracking-widest text-slate-400">Starting From</p>
<p class="text-3xl font-headline font-black text-secondary">$129</p>
</div>
</div>
</div>
</div>
<!-- Regular Card 1 -->
<div class="glass-panel rounded-xl overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
<div class="h-48 relative overflow-hidden">
<img alt="DJ Set" class="w-full h-full object-cover group-hover:scale-105 transition-transform" data-alt="Energetic DJ performing in a dark club with intense cyan and red lighting, hands on mixer, futuristic atmosphere" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeRQqxHz2C0ESUNDH0kyLd6473t-BXnsO2He63lG2ObGTEbXpL9bISwKcmnaKKeFou6zNipW7bJaWN7X2vMzPuCi_m9SU5jDr6VLDNj7Ek6cy4ayOzXWgOL8zaVBlFk7CM8kd4joA-_RbdzcqN1VolI5G5NuzEYvjnRUzgcPF0GjIRZrs7jGv8QOPFrZNoi4hzNaLnTiK4fvtb5py68YAPM0pFbjvoCtyZMhw5kPwyeuFe-LciGn3dofO9Gn5di3JKEemm36iUvfM"/>
<div class="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg text-center min-w-[50px]">
<p class="text-primary font-headline font-black text-lg leading-none">12</p>
<p class="text-[10px] uppercase font-headline font-bold text-slate-400">Nov</p>
</div>
</div>
<div class="p-5">
<h4 class="font-headline font-bold text-lg mb-1 leading-tight group-hover:text-primary transition-colors">CYBERPUNK BEATS: AFTER DARK</h4>
<p class="text-xs text-slate-400 mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-xs">location_on</span> The Void Underground</p>
<div class="flex items-center justify-between pt-4 border-t border-white/5">
<span class="text-secondary font-headline font-bold">$45.00</span>
<button class="bg-surface-container-highest hover:bg-primary hover:text-on-primary-container p-2 rounded-lg transition-colors">
<span class="material-symbols-outlined text-sm">arrow_forward</span>
</button>
</div>
</div>
</div>
<!-- Regular Card 2 -->
<div class="glass-panel rounded-xl overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
<div class="h-48 relative overflow-hidden">
<img alt="Pop Concert" class="w-full h-full object-cover group-hover:scale-105 transition-transform" data-alt="Silhouetted pop star performing on a grand stage with intense white backlighting and golden sparkles falling from above" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBXLWFLcsoZ3FnCGc5OvZCGHm7rcf5CXinat-r-zSWh_k7RzBojmpcKwKjt8Yxkmudpi4alAgjtW3n-gcb5BBUM3RtrKFlxzz7LLsPSZmoVWniekug6Z0AEPUVju2l20us-qP0nD8LSOo2W7STNuQm96VMfOuRaMva6EdsIXbvA89d851kyyAVt1cHx9Mpof_mtKBWsozve5_Ue0Ytcc0cRaKI6T7hCd3jpq5W96bQnANSttll7ItiMoRAcR5ZS9ssdlcKpjvABUWg"/>
<div class="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg text-center min-w-[50px]">
<p class="text-primary font-headline font-black text-lg leading-none">15</p>
<p class="text-[10px] uppercase font-headline font-bold text-slate-400">Nov</p>
</div>
</div>
<div class="p-5">
<h4 class="font-headline font-bold text-lg mb-1 leading-tight group-hover:text-primary transition-colors">LUNA SOLA: GALAXY TOUR</h4>
<p class="text-xs text-slate-400 mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-xs">location_on</span> Grand Nebula Hall</p>
<div class="flex items-center justify-between pt-4 border-t border-white/5">
<span class="text-secondary font-headline font-bold">$89.00</span>
<button class="bg-surface-container-highest hover:bg-primary hover:text-on-primary-container p-2 rounded-lg transition-colors">
<span class="material-symbols-outlined text-sm">arrow_forward</span>
</button>
</div>
</div>
</div>
<!-- Regular Card 3 -->
<div class="glass-panel rounded-xl overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
<div class="h-48 relative overflow-hidden">
<img alt="Jazz Night" class="w-full h-full object-cover group-hover:scale-105 transition-transform" data-alt="Close up of a polished saxophone on a dimly lit jazz club stage with warm bokeh lights and smoky atmosphere" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKsPqi8RqPWNG-bq_iN_cRCoMz11oS5oIgQ17Y1B4e1cd0IQjbY3rgsj7nShTCGVtn_sYrsPlv_LhBzk-5eIjPIT-3Dyc0FBihOHsjSu22QaTwXruok8E0xN-a45pb3txmre725ZLOaUiB2ryvtXAqljxCONEFOYdD5ld6Vi9BZWxZpwfXYyBJVxWcjF1r7ozbbBdyA3Kp5N3OXEaLe4IsRAVt1pA8rGh7SrByjKLJguRAkF5FUXnrVkbnI2a438wfcaybfQDXJVE"/>
<div class="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg text-center min-w-[50px]">
<p class="text-primary font-headline font-black text-lg leading-none">18</p>
<p class="text-[10px] uppercase font-headline font-bold text-slate-400">Nov</p>
</div>
</div>
<div class="p-5">
<h4 class="font-headline font-bold text-lg mb-1 leading-tight group-hover:text-primary transition-colors">INTERSTELLAR JAZZ SESSIONS</h4>
<p class="text-xs text-slate-400 mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-xs">location_on</span> Blue Moon Lounge</p>
<div class="flex items-center justify-between pt-4 border-t border-white/5">
<span class="text-secondary font-headline font-bold">$35.00</span>
<button class="bg-surface-container-highest hover:bg-primary hover:text-on-primary-container p-2 rounded-lg transition-colors">
<span class="material-symbols-outlined text-sm">arrow_forward</span>
</button>
</div>
</div>
</div>
<!-- Regular Card 4 -->
<div class="glass-panel rounded-xl overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
<div class="h-48 relative overflow-hidden">
<img alt="Electronic Event" class="w-full h-full object-cover group-hover:scale-105 transition-transform" data-alt="Abstract digital projection on a stage with complex geometric light patterns and vibrant electric blue colors" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCidHml2cEoNSJ_OykFMGS6vr28zPvrhx_0XXsl-t0IMiXsrKbGaNF2V_8hVp0XBf0GiY2jy0otV3zKUmieBhKre_w3iEEurAsAJbclaeBDwVP-NvCKPtMRa4XGbaYi_hOlRmQVzx-zeiEgupUhqSUp4Iu2fQgRjK-FOj3aVLRy-sP3fqPNH764RMIANXmIi2bho_rdO7v_57jCx7in81sBzisSKWyDguKp1oI22CdeL2n4CAq5P1MWGh5wLYvJHjGxczjWE7TkTZM"/>
<div class="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg text-center min-w-[50px]">
<p class="text-primary font-headline font-black text-lg leading-none">22</p>
<p class="text-[10px] uppercase font-headline font-bold text-slate-400">Nov</p>
</div>
</div>
<div class="p-5">
<h4 class="font-headline font-bold text-lg mb-1 leading-tight group-hover:text-primary transition-colors">SYNTHWAVE SUNDAY: 2099</h4>
<p class="text-xs text-slate-400 mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-xs">location_on</span> Retro Future Hub</p>
<div class="flex items-center justify-between pt-4 border-t border-white/5">
<span class="text-secondary font-headline font-bold">$25.00</span>
<button class="bg-surface-container-highest hover:bg-primary hover:text-on-primary-container p-2 rounded-lg transition-colors">
<span class="material-symbols-outlined text-sm">arrow_forward</span>
</button>
</div>
</div>
</div>
</div>
<!-- Pagination -->
<div class="mt-16 flex items-center justify-center gap-2">
<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:bg-primary-container hover:text-white transition-all">
<span class="material-symbols-outlined">chevron_left</span>
</button>
<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-on-primary-container font-headline font-bold">1</button>
<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:text-white transition-all">2</button>
<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:text-white transition-all">3</button>
<span class="px-2 text-slate-500">...</span>
<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:text-white transition-all">8</button>
<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-highest text-slate-400 hover:bg-primary-container hover:text-white transition-all">
<span class="material-symbols-outlined">chevron_right</span>
</button>
</div>
</div>
</div>
</main>
<!-- Footer -->
<footer class="bg-slate-950 full-width py-12 border-t border-white/5 mt-20">
<div class="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
<div class="col-span-2 md:col-span-1">
<span class="text-xl font-black text-red-500 font-headline mb-4 block">TicketRush</span>
<p class="text-slate-500 text-xs font-body leading-relaxed max-w-xs">The ultimate portal for interstellar event experiences. Speed, depth, and celestial elegance in every ticket.</p>
</div>
<div>
<h5 class="font-['Space_Grotesk'] tracking-wide uppercase text-xs font-semibold text-red-400 mb-6">Marketplace</h5>
<ul class="space-y-4">
<li><a class="text-slate-500 text-xs uppercase tracking-wider font-headline font-semibold hover:text-red-400 transition-colors" href="#">Sell Tickets</a></li>
<li><a class="text-slate-500 text-xs uppercase tracking-wider font-headline font-semibold hover:text-red-400 transition-colors" href="#">Artist Portal</a></li>
<li><a class="text-slate-500 text-xs uppercase tracking-wider font-headline font-semibold hover:text-red-400 transition-colors" href="#">Affiliates</a></li>
</ul>
</div>
<div>
<h5 class="font-['Space_Grotesk'] tracking-wide uppercase text-xs font-semibold text-red-400 mb-6">Support</h5>
<ul class="space-y-4">
<li><a class="text-slate-500 text-xs uppercase tracking-wider font-headline font-semibold hover:text-red-400 transition-colors" href="#">Help Center</a></li>
<li><a class="text-slate-500 text-xs uppercase tracking-wider font-headline font-semibold hover:text-red-400 transition-colors" href="#">Terms of Service</a></li>
<li><a class="text-slate-500 text-xs uppercase tracking-wider font-headline font-semibold hover:text-red-400 transition-colors" href="#">Privacy Policy</a></li>
</ul>
</div>
<div>
<h5 class="font-['Space_Grotesk'] tracking-wide uppercase text-xs font-semibold text-red-400 mb-6">Newsletter</h5>
<div class="flex gap-2">
<input class="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs w-full focus:ring-1 focus:ring-primary outline-none" placeholder="Email" type="email"/>
<button class="bg-primary text-on-primary-container px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">Join</button>
</div>
</div>
</div>
<div class="max-w-screen-2xl mx-auto px-6 mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
<p class="text-slate-500 text-[10px] uppercase tracking-widest font-headline font-semibold opacity-80">© 2024 TicketRush. Powered by the Cosmic Voyager.</p>
<div class="flex gap-6">
<span class="material-symbols-outlined text-slate-500 hover:text-primary transition-colors cursor-pointer">public</span>
<span class="material-symbols-outlined text-slate-500 hover:text-primary transition-colors cursor-pointer">language</span>
<span class="material-symbols-outlined text-slate-500 hover:text-primary transition-colors cursor-pointer">verified_user</span>
</div>
</div>
</footer>
</body></html>