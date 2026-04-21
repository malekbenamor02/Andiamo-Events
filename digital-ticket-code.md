Page: Minimalist Red & Grey Digital Ticket

```html
<!DOCTYPE html>
<html lang="en"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modern Redline Digital Ticket</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
    <link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800&amp;f[]=satoshi@500,700&amp;display=swap" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Satoshi', sans-serif;
        }

        .font-display {
            font-family: 'Cabinet Grotesk', sans-serif;
        }

        .diagonal-split {
            clip-path: polygon(0 0, 70% 0, 55% 100%, 0% 100%);
        }

        .grey-accent {
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ticket-noise {
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
            opacity: 0.05;
        }

        .perforation-dots {
            background-image: radial-gradient(circle, #334155 2px, transparent 2px);
            background-size: 100% 12px;
        }
    </style>
</head>
<body>
    <div class="min-h-screen bg-[#121212] flex items-center justify-center p-6">
        <!-- TICKET CONTAINER -->
        <div class="relative w-full max-w-[1000px] h-[500px] bg-[#1a1a1a] rounded-[3rem] overflow-hidden flex shadow-2xl shadow-black border border-white/10">
            
            <!-- BACKGROUND LAYER -->
            <div class="absolute inset-0 z-0 bg-gradient-to-br from-[#1a1a1a] via-[#1a1a1a] to-[#2d2d2d]">
                <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 32px 32px;"></div>
            </div>

            <!-- LEFT DIAGONAL CONTENT (INFO) -->
            <div class="relative z-10 w-full md:w-[65%] h-full p-12 flex flex-col justify-between">
                <!-- OVERLAY COLOR -->
                <div class="absolute inset-0 diagonal-split bg-[#1a1a1a]/95 backdrop-blur-md -z-10"></div>
                
                <header class="flex items-center gap-4">
                    
                    <span class="font-display text-white text-xl tracking-widest uppercase opacity-80">LOGO OF ANdiamo</span>
                </header>

                <main class="mt-8">
                    
                    <h1 class="font-display text-7xl text-white leading-none uppercase italic tracking-tighter">
                        REDLINE <br>
                        <span class="text-[#E63946]">FESTIVAL</span>
                    </h1>
                    
                    <div class="flex items-center gap-2 mb-2">
                        <span class="w-8 h-px bg-[#E63946]"></span>
                        <p class="text-[#E63946] font-bold tracking-[0.3em] text-xs uppercase">Event by Andiamo</p>
                    </div><div class="mt-10 flex flex-wrap gap-x-12 gap-y-6">
                        <div class="space-y-1">
                            <p class="text-slate-500 text-[10px] tracking-[0.2em] uppercase font-bold">Date &amp; Time</p>
                            <p class="text-white font-medium">OCT 12 • 21:00 PM</p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-slate-500 text-[10px] tracking-[0.2em] uppercase font-bold">Location</p>
                            <p class="text-white font-medium">CITY • VENUE</p>
                        </div>
                    </div>
                </main>

                <footer class="flex items-center gap-4 opacity-50">
                    <iconify-icon icon="lucide:shield-check" class="text-white text-xl"></iconify-icon>
                    <p class="text-white text-xs tracking-widest uppercase">Each QR code is valid for <strong>one-time use and one person only</strong>.</p>
                </footer>
            </div>

            <!-- PERFORATION -->
            <div class="hidden md:block relative w-0.5 h-full z-20">
                <div class="absolute inset-0 perforation-dots"></div>
            </div>

            <!-- RIGHT SECTION (VALIDATION) -->
            <div class="relative z-10 w-full md:w-[35%] h-full p-12 flex flex-col items-center justify-between text-center">
                <div class="absolute inset-0 bg-[#2d2d2d]/40 backdrop-blur-md -z-10"></div>
                
                <!-- PASS BADGE -->
                <div class="w-full">
                    <div class="bg-[#E63946] text-white py-3 px-6 rounded-2xl inline-block shadow-lg shadow-black/20 rotate-2">
                        
                        <p class="font-display text-xl">TYPE OF PASS</p>
                    </div>
                </div>

                <!-- QR AREA -->
                <div class="flex flex-col items-center gap-4">
                    <div class="relative p-4 bg-white rounded-[2.5rem] grey-accent" style="border-radius: 16px;">
                        <div class="w-36 h-36">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&amp;data=REDLINE-2024-VIP-NYC" class="w-full h-full object-contain" alt="Verification QR">
                        </div>
                        <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest whitespace-nowrap border border-[#E63946]">
                            Scan to Enter
                        </div>
                    </div>
                    <div class="mt-4 space-y-1">
                        <p class="text-slate-500 text-[10px] tracking-[0.3em] uppercase">Order Number:</p>
                        <p class="text-white font-mono text-sm tracking-[0.2em]">#548647</p>
                    </div>
                </div>

                <div class="w-full h-px bg-white/10"></div>
                
                <div class="text-slate-400 text-[10px] leading-relaxed"><strong>Entry is granted only with a <br>Valid QR code</strong>.</div>
            </div>

            <!-- DECORATIVE RED ELEMENTS -->
            <div class="absolute top-10 right-10 w-48 h-48 bg-white/5 blur-[100px] pointer-events-none"></div>
            <div class="absolute bottom-10 left-1/2 w-64 h-24 bg-white/2 blur-[80px] pointer-events-none"></div>
            <div class="ticket-noise absolute inset-0 pointer-events-none"></div>
        </div>
    </div>

</body></html>
```

Please reference this design and implement it into our codebase; Try to understand the structure, which part of our codebase is relevant and implement
