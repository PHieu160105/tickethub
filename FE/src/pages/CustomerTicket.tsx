<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>TicketRush | My Tickets</title>
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
            min-height: 100vh;
        }
        .glass-panel {
            background: rgba(26, 30, 55, 0.8);
            backdrop-filter: blur(12px) saturate(180%);
            border-top: 1px solid rgba(255, 178, 183, 0.2);
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
        }
        .velocity-indicator {
            background: linear-gradient(90deg, #ffb2b7, #f0c03e);
        }
    </style>
</head>
<body class="font-body text-on-surface">
<!-- TopNavBar Shell -->
<header class="bg-slate-950/80 backdrop-blur-xl border-b border-white/10 docked full-width top-0 sticky z-50 shadow-[0_0_15px_rgba(233,69,96,0.2)]">
<div class="flex justify-between items-center w-full px-6 py-4 max-w-screen-2xl mx-auto">
<div class="flex items-center gap-8">
<div class="text-2xl font-black italic tracking-tighter text-red-500 uppercase font-headline">
                    TicketRush
                </div>
<nav class="hidden md:flex gap-6">
<a class="text-slate-300 hover:text-white transition-colors font-['Space_Grotesk'] font-bold tracking-tight" href="#">Events</a>
<a class="text-slate-300 hover:text-white transition-colors font-['Space_Grotesk'] font-bold tracking-tight" href="#">Venues</a>
<a class="text-slate-300 hover:text-white transition-colors font-['Space_Grotesk'] font-bold tracking-tight" href="#">Deals</a>
<a class="text-red-500 border-b-2 border-red-500 pb-1 font-['Space_Grotesk'] font-bold tracking-tight" href="#">My Tickets</a>
</nav>
</div>
<div class="flex items-center gap-4">
<div class="hidden sm:flex bg-white/5 rounded-full px-4 py-1.5 items-center gap-2 border border-white/10">
<span class="material-symbols-outlined text-slate-400 text-lg">search</span>
<input class="bg-transparent border-none focus:ring-0 text-sm w-48 text-white placeholder-slate-500" placeholder="Find stars..." type="text"/>
</div>
<button class="material-symbols-outlined text-slate-300 hover:text-red-400 transition-colors">notifications</button>
<button class="material-symbols-outlined text-slate-300 hover:text-red-400 transition-colors">shopping_cart</button>
<div class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container">
<img alt="User profile" data-alt="Close up portrait of a young man with a slight smile in dramatic low light urban setting, cinematic tones" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpmxNGn5W6mI7iCD4GiEuifgXkamRp7Dm6BxPvJP0K1bwFJ6rJ7ubRKRdK2izhPmHDAfvW9ZK2BFVGGGsGgAH_lhbNhm2KnAj7bf0Urx9A5mohUXtkp-zJMy3TPAfhYb3u7xGannqj52V8LV4pNn5VsjfTkEIjSvrFosY_P6Jrat4B2HQTapiJn-qpXmdJ9Mo3Ncx3UsMEcHNjt3Vrcd3tQLmHdBZDJeRgP9zC9H15X282BLpjXq3Mv-sJTMZDFPgw5Gjasi0ODaY"/>
</div>
</div>
</div>
</header>
<div class="max-w-screen-2xl mx-auto flex min-h-[calc(100vh-80px)]">
<!-- Sidebar Navigation -->
<aside class="w-64 hidden md:flex flex-col border-r border-white/5 py-8 px-6 gap-8">
<div class="flex flex-col items-center text-center gap-3">
<div class="relative">
<div class="w-20 h-20 rounded-full overflow-hidden border-2 border-secondary shadow-[0_0_20px_rgba(240,192,62,0.3)]">
<img alt="Avatar" data-alt="Close up portrait of a young man with a slight smile in dramatic low light urban setting, cinematic tones" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8IkeEeErhEku5lG_4Sw1oPAJJADVD4x7S8pwqz0jyQCR7rFduMxGbEJPVBSzlD_jv-qS8De9BhkqjLGzLuVC5toFTfgIRjvPEcamZrfwAWiwXczfrEHNyaT7IcHJbiev-ve7YMr2CNDQnaIjWIcZnzYMW5Kco39Nod3sRytR5HmfMghpca2N3jcSX9Z-Tw-kIqnbglf10qRiwEkXwvyPp5eiQLVfQ28Ot88AHLwpbq9OTAMvxRAeMGPL3Ocr5Ua4rXMZy-bVXnEw"/>
</div>
<div class="absolute bottom-0 right-0 bg-secondary rounded-full p-1 border-2 border-background">
<span class="material-symbols-outlined text-background text-xs" style="font-variation-settings: 'FILL' 1;">star</span>
</div>
</div>
<div>
<h3 class="font-headline font-bold text-white tracking-tight">Alex Voyager</h3>
<p class="text-xs text-secondary font-label uppercase tracking-widest mt-1">Stellar Member</p>
</div>
</div>
<nav class="flex flex-col gap-2">
<a class="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-container/20 text-primary-fixed-dim font-medium transition-all group" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">confirmation_number</span>
<span>My Tickets</span>
</a>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-white/5 transition-all group" href="#">
<span class="material-symbols-outlined">person</span>
<span>My Profile</span>
</a>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-white/5 transition-all group" href="#">
<span class="material-symbols-outlined">favorite</span>
<span>Watchlist</span>
</a>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-white/5 transition-all group" href="#">
<span class="material-symbols-outlined">payments</span>
<span>Payment Methods</span>
</a>
<a class="flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-white/5 transition-all group mt-10" href="#">
<span class="material-symbols-outlined">settings</span>
<span>Settings</span>
</a>
</nav>
</aside>
<!-- Main Content Area -->
<main class="flex-1 p-6 md:p-12 overflow-y-auto">
<header class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
<div>
<h1 class="text-5xl font-black font-headline text-white tracking-tighter mb-2">My Tickets</h1>
<p class="text-on-surface-variant max-w-md">Access your boarding passes to the most exclusive experiences in the galaxy.</p>
</div>
<!-- Tabs -->
<div class="flex p-1 bg-surface-container-highest/50 rounded-full border border-white/5 backdrop-blur-sm self-start">
<button class="px-6 py-2 rounded-full bg-primary-container text-on-primary-container font-semibold text-sm transition-all">Upcoming</button>
<button class="px-6 py-2 rounded-full text-on-surface-variant hover:text-white font-semibold text-sm transition-all">Past</button>
<button class="px-6 py-2 rounded-full text-on-surface-variant hover:text-white font-semibold text-sm transition-all">Cancelled</button>
</div>
</header>
<!-- Ticket List: Bento/Asymmetric Layout -->
<div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
<!-- Ticket Card 1 -->
<div class="glass-panel rounded-full overflow-hidden flex flex-col md:flex-row relative group">
<div class="w-full md:w-48 h-64 md:h-auto overflow-hidden relative">
<img alt="Concert Poster" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" data-alt="High energy music concert with bright pink and blue spotlights, crowd silhouette with hands raised in excitement" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAPoRLUR94VxdNMZU6eczD5L4Vb9x4zvCHESwz5Qr2kyHC3kWOPSy0777q6jzR1OUWmjlFHPKNuBTNHKtE3IpWp7LjhEvbp35d0WjLvTgyO3O87XwCPdeGN1z5JGmFIg47JsLYazJT4h1_P12t0pq_iLZqK07r6DoxUdFrS4J-2vqEiWSdZnqJyO5gRaIilwjsMeYnqvEaJJGthdzu7u1dSAKKtHYIkN2fpEj8f62edEgHUxFFSXUvcctHk94tDwRrLkbdgXdSqQa0"/>
<div class="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent md:hidden"></div>
</div>
<div class="flex-1 p-8 flex flex-col justify-between">
<div>
<div class="flex justify-between items-start mb-4">
<span class="px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-[10px] font-black uppercase tracking-widest">Confirmed</span>
<span class="text-on-surface-variant text-xs font-label">TICKET #TR-8829-X</span>
</div>
<h2 class="text-2xl font-black font-headline text-white leading-tight mb-2 uppercase tracking-tighter">Neon Nebula: Live in Orion</h2>
<div class="flex flex-wrap gap-x-6 gap-y-2 text-on-surface-variant text-sm mb-6">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-primary text-base">calendar_today</span>
<span>Oct 24, 2024</span>
</div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-primary text-base">location_on</span>
<span>The Supernova Arena</span>
</div>
</div>
</div>
<div class="flex items-center gap-4">
<button class="flex-1 bg-primary-container text-on-primary-container py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:shadow-[0_0_15px_rgba(252,83,109,0.4)] transition-all active:scale-95">View Details</button>
<button class="p-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all">
<span class="material-symbols-outlined text-white">download</span>
</button>
</div>
</div>
<!-- QR Sidebar / Accent -->
<div class="w-24 bg-white/5 border-l border-white/5 flex flex-col items-center justify-center gap-4 hidden sm:flex">
<div class="bg-white p-1 rounded-sm">
<img alt="QR Code" class="grayscale invert" data-alt="Stylized digital pixelated square pattern representing a QR code scan zone" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmYn9Av3DghpNY-bG3LShxv382bxXEUEhAMv47ZzPy4aNmfDJxmBLqjQwALd5b6ihsza88R30r-TNi08qFWr5oPnJXNuC8akp6MT7e3VxVL5UbDQf_Qa6vC_vqfSoF8vSerrcYQ6-y9bEEsuXPn7ItZtBA8pQIXcpGctSYVLiObx6F1bDPEv5vEpINoDTyZ2_jomBjFL9iC0ViuolFzQ5tEroGgsrIltRAO5iyC4sP2p49WSUIKxttYCkGzLNItbDs6IVyVKz6uW4"/>
</div>
<span class="rotate-90 text-[10px] font-label text-slate-500 uppercase tracking-widest whitespace-nowrap">Scan at Gate 07</span>
</div>
</div>
<!-- Ticket Card 2 -->
<div class="glass-panel rounded-full overflow-hidden flex flex-col md:flex-row relative group">
<div class="w-full md:w-48 h-64 md:h-auto overflow-hidden relative">
<img alt="Festival Poster" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" data-alt="Electric outdoor dance festival at night with lasers hitting smoke and large stage structures" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYPTg8N2MSd6Lr_OZNVFqe9J7l_bZ9KN_8RZcMEk9OlKcH3S0SZ1ZOMVpz-DHimn_VllZsO376X1BwrP0VRPOIO2dOSmLIhECejxroX-0ZQi3iSKJ29T5ei0Y707BeBNIZCROoIO7NPIdQQ9cj59Vm8AqD_nIhL-7IlEoKV7WWf07twvN4_ACOnofbUPVAZACgsRXThJ5-FJAw7TFQpkfMY7jQrSgMaLoxHB1-VxOGsYAjzMPsQ7ISpNfCKp7-Yo0gDYFDOKTFjUU"/>
<div class="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent md:hidden"></div>
</div>
<div class="flex-1 p-8 flex flex-col justify-between">
<div>
<div class="flex justify-between items-start mb-4">
<span class="px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-[10px] font-black uppercase tracking-widest">Confirmed</span>
<span class="text-on-surface-variant text-xs font-label">TICKET #TR-1105-V</span>
</div>
<h2 class="text-2xl font-black font-headline text-white leading-tight mb-2 uppercase tracking-tighter">Warp Speed Festival 3024</h2>
<div class="flex flex-wrap gap-x-6 gap-y-2 text-on-surface-variant text-sm mb-6">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-primary text-base">calendar_today</span>
<span>Nov 12, 2024</span>
</div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-primary text-base">location_on</span>
<span>Lunar Base Alpha</span>
</div>
</div>
</div>
<div class="flex items-center gap-4">
<button class="flex-1 bg-primary-container text-on-primary-container py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:shadow-[0_0_15px_rgba(252,83,109,0.4)] transition-all active:scale-95">View Details</button>
<button class="p-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all">
<span class="material-symbols-outlined text-white">download</span>
</button>
</div>
</div>
<div class="w-24 bg-white/5 border-l border-white/5 flex flex-col items-center justify-center gap-4 hidden sm:flex">
<div class="bg-white p-1 rounded-sm">
<img alt="QR Code" class="grayscale invert" data-alt="Stylized digital pixelated square pattern representing a QR code scan zone" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgBbbJJbtOqERktcK9V_jOnLzTSE2IQa5QyFjVTX4M8gl5hBqfufzbR0UCK6ej6Za5Vh7gTsTCRtJx88BZhaZp6ssjIvRw95Pl9mMPEHX5mci6BIoQNoiDdyjcAF-aCTfyupgxgAig6vbok6FgtPeT1NBbHBM6efs_B5uewGv3mD-FQcCIF6QF2k0c6tfco5nbrwCkG41th1sDpFVa8ggxP8uB1EXYGt7BbIgedaenYOlf2cjoABZwxCnskl--rq69mzXSmPdf7_o"/>
</div>
<span class="rotate-90 text-[10px] font-label text-slate-500 uppercase tracking-widest whitespace-nowrap">VIP Entrance ONLY</span>
</div>
</div>
<!-- Ticket Card 3 (Asymmetric/Special highlight) -->
<div class="glass-panel rounded-full overflow-hidden flex flex-col md:flex-row relative group xl:col-span-2 border-primary-container/30">
<div class="w-full md:w-72 h-64 md:h-auto overflow-hidden relative">
<img alt="Special Event" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" data-alt="Elegant gala interior with crystal chandeliers and golden lighting, sophisticated festive atmosphere" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHEbmjooa91O0jOJEm6UsGxfuN9aVq_jmYuruwWdndcDxMlM5aqbXR-LpZqUC0u_BRP19gP2H_JwEsTKd9o1WMDvcFcJ6Ys-03gyvXj_IuHp7Avvx-cWymjPNJxuIcrK-0PfUFuKzvWsB72bKYpwbpVw5JzHp0aZY0RW3dZeZxa9PWZlylps3jQP-4z8iRGPSukU5B3abBSz6lqEsZB9TY7b9N5y2IOKHuqngUJz88HijyPiOOgO-My4yrohagvJzVJnPrtJCCW5g"/>
<div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-surface-container/60"></div>
<div class="absolute top-4 left-4">
<span class="px-4 py-1 bg-secondary text-background font-black text-xs uppercase tracking-[0.2em] rounded-full">Legendary Tier</span>
</div>
</div>
<div class="flex-1 p-8 md:p-12 flex flex-col justify-center">
<div class="flex justify-between items-start mb-6">
<div class="bg-secondary/20 text-secondary px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Early Access Granted</div>
<span class="text-on-surface-variant text-xs font-label">TICKET #TR-PREM-001</span>
</div>
<h2 class="text-4xl md:text-5xl font-black font-headline text-white leading-none mb-6 uppercase tracking-tighter">Cosmic Voyager Gala</h2>
<p class="text-on-surface-variant mb-8 max-w-lg">You are invited to the edge of space for the annual interstellar gathering. Includes open bar at the Milky Way Lounge and private shuttle service.</p>
<div class="flex flex-wrap gap-8 text-on-surface-variant text-sm mb-10">
<div class="flex flex-col">
<span class="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Star Date</span>
<span class="text-white font-bold text-lg">DEC 31, 2024</span>
</div>
<div class="flex flex-col">
<span class="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Galaxy Location</span>
<span class="text-white font-bold text-lg">Nebula Hall, Sector 7</span>
</div>
<div class="flex flex-col">
<span class="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Gate Pass</span>
<span class="text-white font-bold text-lg">Hangar 99</span>
</div>
</div>
<div class="flex items-center gap-6">
<button class="px-10 bg-primary-container text-on-primary-container py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(252,83,109,0.5)] transition-all active:scale-95">Claim Voyager Perks</button>
<button class="flex items-center gap-2 text-secondary font-bold uppercase tracking-widest text-xs hover:text-white transition-colors">
<span class="material-symbols-outlined">qr_code_2</span>
<span>Reveal Boarding Key</span>
</button>
</div>
</div>
</div>
</div>
</main>
</div>
<!-- Footer Shell -->
<footer class="bg-slate-950 full-width py-12 border-t border-white/5 mt-20">
<div class="grid grid-cols-2 md:grid-cols-4 gap-8 px-6 max-w-screen-2xl mx-auto">
<div class="col-span-2 md:col-span-1">
<div class="text-xl font-black text-red-500 font-headline italic uppercase mb-6">TicketRush</div>
<p class="text-slate-500 text-xs font-label leading-relaxed">
                    Elevating your experience beyond the terrestrial. The galaxy's leading platform for moments that matter.
                </p>
</div>
<div class="flex flex-col gap-4">
<h4 class="text-white font-headline font-bold text-sm uppercase tracking-widest mb-2">Navigation</h4>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">Help Center</a>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">Sell Tickets</a>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">Artist Portal</a>
</div>
<div class="flex flex-col gap-4">
<h4 class="text-white font-headline font-bold text-sm uppercase tracking-widest mb-2">Legal</h4>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">Terms of Service</a>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">Privacy Policy</a>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-['Space_Grotesk'] tracking-wide uppercase font-semibold" href="#">Affiliates</a>
</div>
<div class="flex flex-col gap-6">
<h4 class="text-white font-headline font-bold text-sm uppercase tracking-widest">Connect</h4>
<div class="flex gap-4">
<div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-container transition-all group">
<span class="material-symbols-outlined text-slate-400 group-hover:text-on-primary-container text-sm">public</span>
</div>
<div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-container transition-all group">
<span class="material-symbols-outlined text-slate-400 group-hover:text-on-primary-container text-sm">alternate_email</span>
</div>
<div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-container transition-all group">
<span class="material-symbols-outlined text-slate-400 group-hover:text-on-primary-container text-sm">smart_display</span>
</div>
</div>
<p class="text-[10px] text-slate-600 font-label leading-tight">© 2024 TicketRush. Powered by the Cosmic Voyager.</p>
</div>
</div>
</footer>
<!-- Mobile Bottom Navigation -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 px-6 py-4 flex justify-between items-center z-50">
<button class="flex flex-col items-center gap-1 text-slate-400">
<span class="material-symbols-outlined">explore</span>
<span class="text-[10px] font-label uppercase">Explore</span>
</button>
<button class="flex flex-col items-center gap-1 text-primary-fixed-dim">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">confirmation_number</span>
<span class="text-[10px] font-label uppercase">Tickets</span>
</button>
<button class="flex flex-col items-center gap-1 text-slate-400">
<span class="material-symbols-outlined">favorite</span>
<span class="text-[10px] font-label uppercase">Saves</span>
</button>
<button class="flex flex-col items-center gap-1 text-slate-400">
<span class="material-symbols-outlined">person</span>
<span class="text-[10px] font-label uppercase">Profile</span>
</button>
</nav>
</body></html>