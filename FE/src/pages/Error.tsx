<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>404 - Page Not Found | TicketRush</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Be+Vietnam+Pro:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
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
      font-family: 'Be Vietnam Pro', sans-serif;
    }
    .material-symbols-outlined {
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    }
    .cosmic-glow {
      box-shadow: 0 0 30px rgba(252, 83, 109, 0.3);
    }
    .glass-panel {
      backdrop-filter: blur(12px) saturate(180%);
      background: rgba(26, 30, 55, 0.8);
      border-top: 1px solid rgba(255, 178, 183, 0.2);
    }
    @keyframes float {
      0% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-20px) rotate(5deg); }
      100% { transform: translateY(0px) rotate(0deg); }
    }
    .animate-float {
      animation: float 6s ease-in-out infinite;
    }
    .star-field {
      background-image: radial-gradient(circle, #ffffff 1px, transparent 1px);
      background-size: 50px 50px;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col text-on-surface overflow-hidden">
<!-- Top Navigation (Shell Suprresed for AuthLayout/404) -->
<header class="fixed top-0 left-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-slate-950/20 backdrop-blur-sm">
<div class="text-2xl font-black italic tracking-tighter text-red-500 uppercase">TicketRush</div>
<div class="hidden md:flex gap-8 items-center font-['Space_Grotesk'] text-slate-300">
<a class="hover:text-white transition-colors" href="#">Events</a>
<a class="hover:text-white transition-colors" href="#">Venues</a>
<a class="hover:text-white transition-colors" href="#">Deals</a>
</div>
</header>
<!-- Main Content Canvas -->
<main class="flex-grow flex items-center justify-center px-6 relative">
<!-- Deep Space Visual Elements -->
<div class="absolute inset-0 z-0 opacity-30 star-field"></div>
<div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-[120px]"></div>
<div class="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-tertiary-container/5 rounded-full blur-[150px]"></div>
<div class="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
<!-- Visual Side -->
<div class="flex justify-center md:justify-end order-1 md:order-2">
<div class="relative w-64 h-64 md:w-96 md:h-96 animate-float">
<!-- Astronaut Avatar Representation -->
<div class="absolute inset-0 glass-panel rounded-full border border-white/10 flex items-center justify-center overflow-hidden">
<img alt="Lost Astronaut" class="w-full h-full object-cover grayscale opacity-80" data-alt="minimalist 3d astronaut floating in deep purple space with tiny floating red ticket stubs and lens flare effects" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBujX6dJHvYzmjag9-VzBVgBpIwzwGv2w1JCCXwh53UHcba4hnO3KogJvHdZdSz3QgAR1Zjj3-UbJdYUAHeanGW4xkLqaCJTUE_OPo_aLubaUcbuQ8r98lVSzGpE4hC5U_vbwEuOGwJulterxGaajtAyH394BamuO09tq20YpYWDB7z1NlBWFS8rls7fbUlLMpfcLpOQgyypYX1sYoLcxwqObimzkB1vMWG40BoKaXkoCcyJdmtTILGPIyZ7VBRGQvmdFP_E5Hs_qU"/>
</div>
<!-- Decorative Orbital Ring -->
<div class="absolute -inset-4 border-2 border-dashed border-primary/20 rounded-full animate-[spin_20s_linear_infinite]"></div>
<!-- Signal Icon -->
<div class="absolute top-4 right-4 w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-on-secondary-fixed shadow-[0_0_15px_#f0c03e]">
<span class="material-symbols-outlined" data-icon="satellite_alt">satellite_alt</span>
</div>
</div>
</div>
<!-- Textual Content Side -->
<div class="text-center md:text-left order-2 md:order-1">
<div class="inline-block px-4 py-1 glass-panel rounded-full mb-6 border border-white/5">
<span class="font-headline text-xs font-bold uppercase tracking-[0.2em] text-secondary">Signal Lost</span>
</div>
<h1 class="font-headline text-6xl md:text-8xl font-black tracking-tighter text-white mb-2 italic">
          404
        </h1>
<h2 class="font-headline text-2xl md:text-3xl font-bold tracking-tight text-primary mb-6">
          Page Not Found
        </h2>
<p class="font-body text-lg text-on-surface-variant mb-10 max-w-md mx-auto md:mx-0 leading-relaxed">
          Looks like you're lost in space... The event you're looking for has drifted beyond the event horizon.
        </p>
<!-- Interactive Search Section -->
<div class="relative max-w-md mb-8 group">
<div class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
<span class="material-symbols-outlined" data-icon="search">search</span>
</div>
<input class="w-full bg-surface-container-highest/50 border-0 focus:ring-1 focus:ring-primary rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-slate-500 glass-panel transition-all" placeholder="Search for another event..." type="text"/>
</div>
<!-- Call to Action -->
<div class="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
<a class="bg-primary-container text-on-primary-container font-headline font-bold py-4 px-8 rounded-xl cosmic-glow flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300" href="/">
<span class="material-symbols-outlined" data-icon="home">home</span>
            Back to Home
          </a>
<button class="glass-panel text-white font-headline font-semibold py-4 px-8 rounded-xl border border-white/10 hover:bg-white/5 transition-all active:scale-95 flex items-center justify-center gap-2">
<span class="material-symbols-outlined" data-icon="history">history</span>
             Go Back
          </button>
</div>
</div>
</div>
</main>
<!-- Navigation Shell (Footer Fragment) -->
<footer class="w-full py-12 border-t border-white/5 bg-slate-950 mt-auto">
<div class="max-w-screen-2xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
<div class="col-span-2 md:col-span-1">
<div class="text-xl font-black text-red-500 mb-4">TicketRush</div>
<p class="text-slate-500 text-sm font-['Space_Grotesk'] uppercase tracking-wide">
          © 2024 TicketRush. Powered by the Cosmic Voyager.
        </p>
</div>
<div class="flex flex-col gap-2">
<span class="font-['Space_Grotesk'] text-xs font-semibold uppercase text-slate-400 tracking-widest mb-2">Navigation</span>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-semibold uppercase" href="#">Terms of Service</a>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-semibold uppercase" href="#">Privacy Policy</a>
</div>
<div class="flex flex-col gap-2">
<span class="font-['Space_Grotesk'] text-xs font-semibold uppercase text-slate-400 tracking-widest mb-2">Support</span>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-semibold uppercase" href="#">Help Center</a>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-semibold uppercase" href="#">Sell Tickets</a>
</div>
<div class="flex flex-col gap-2">
<span class="font-['Space_Grotesk'] text-xs font-semibold uppercase text-slate-400 tracking-widest mb-2">Partners</span>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-semibold uppercase" href="#">Artist Portal</a>
<a class="text-slate-500 hover:text-red-400 transition-colors text-xs font-semibold uppercase" href="#">Affiliates</a>
</div>
</div>
</footer>
</body></html>