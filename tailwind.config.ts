import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				neon: {
					purple: 'hsl(var(--neon-purple))',
					cyan: 'hsl(var(--neon-cyan))',
					pink: 'hsl(var(--neon-pink))',
					yellow: 'hsl(var(--neon-yellow))',
					orange: 'hsl(var(--neon-orange))',
					red: 'hsl(var(--neon-purple))', // Neon Red uses neon-purple variable
					gold: 'hsl(var(--neon-yellow))' // Neon Gold uses neon-yellow variable
				}
			},
			fontFamily: {
				// Montserrat - Global Default (Google Fonts)
				sans: ['Montserrat', 'sans-serif'], // Set as default sans-serif
				heading: ['Montserrat', 'sans-serif'],
				body: ['Montserrat', 'sans-serif'],
				// Arabic Font (GE SS Two Bold) - Self-hosted
				arabic: ['GE SS Two', 'Montserrat', 'sans-serif'],
				// Legacy font names for backward compatibility
				josefin: ['Montserrat', 'sans-serif'],
				saira: ['Montserrat', 'sans-serif'],
			},
			fontWeight: {
				thin: '200',
				light: '300',
				normal: '300',
				medium: '400',
				semibold: '500',
				bold: '600',
				extrabold: '700',
				black: '800',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'collapsible-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-collapsible-content-height)' }
				},
				'collapsible-up': {
					from: { height: 'var(--radix-collapsible-content-height)' },
					to: { height: '0' }
				},
				'gradient-shift': {
					'0%, 100%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' }
				},
				'pulse-glow': {
					'0%, 100%': { filter: 'drop-shadow(0 0 10px hsl(var(--primary) / 0.5))' },
					'50%': { filter: 'drop-shadow(0 0 20px hsl(var(--primary) / 0.8))' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'fade-in-up': {
					from: { opacity: '0', transform: 'translateY(30px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-down-in': {
					'0%': { opacity: '0', transform: 'translateY(-100%)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-up-out': {
					'0%': { opacity: '1', transform: 'translateY(0)' },
					'100%': { opacity: '0', transform: 'translateY(-100%)' }
				},
				'timer-bar-shimmer': {
					'0%': { transform: 'translateX(-120%) skewX(-12deg)' },
					'18%, 100%': { transform: 'translateX(220%) skewX(-12deg)' }
				},
				'luminous-timer': {
					'0%, 100%': {
						filter: 'drop-shadow(0 0 2px hsl(var(--primary) / 0.35))',
						transform: 'scale(1)'
					},
					'50%': {
						filter: 'drop-shadow(0 0 12px hsl(var(--primary) / 0.75))',
						transform: 'scale(1.02)'
					}
				},
				'chapter-card-enter': {
					from: { opacity: '0', transform: 'translateX(16px) translateY(8px)' },
					to: { opacity: '1', transform: 'translateX(0) translateY(0)' }
				},
				'chapter-node-pop': {
					'0%': { opacity: '0', transform: 'scale(0.6)' },
					'70%': { transform: 'scale(1.08)' },
					'100%': { opacity: '1', transform: 'scale(1)' }
				},
				'chapter-line-grow': {
					from: { transform: 'scaleY(0)' },
					to: { transform: 'scaleY(1)' }
				},
				'admin-row-enter': {
					from: { opacity: '0', transform: 'translateY(-2px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'admin-status-pulse-emerald': {
					'0%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.45)' },
					'70%': { boxShadow: '0 0 0 5px rgba(16, 185, 129, 0)' },
					'100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' }
				},
				'admin-status-pulse-amber': {
					'0%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.45)' },
					'70%': { boxShadow: '0 0 0 5px rgba(245, 158, 11, 0)' },
					'100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' }
				},
				'trainer-float-drift': {
					'0%, 100%': { transform: 'translate(0, 0)' },
					'15%': { transform: 'translate(8px, -12px)' },
					'30%': { transform: 'translate(-10px, -8px)' },
					'45%': { transform: 'translate(-6px, 10px)' },
					'60%': { transform: 'translate(12px, 6px)' },
					'75%': { transform: 'translate(4px, -14px)' },
					'90%': { transform: 'translate(-8px, 4px)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'collapsible-down': 'collapsible-down 0.22s ease-out',
				'collapsible-up': 'collapsible-up 0.2s ease-in',
				'gradient-shift': 'gradient-shift 3s ease infinite',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'float': 'float 3s ease-in-out infinite',
				'fade-in-up': 'fade-in-up 0.6s ease-out',
				'spin-slow': 'spin 3s linear infinite',
				'slide-down-in': 'slide-down-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
				'slide-up-out': 'slide-up-out 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards',
				'timer-bar-shimmer': 'timer-bar-shimmer 8s linear infinite',
				'luminous-timer': 'luminous-timer 3s ease-in-out infinite',
				'chapter-card-enter': 'chapter-card-enter 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards',
				'chapter-node-pop': 'chapter-node-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
				'chapter-line-grow': 'chapter-line-grow 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards',
				'trainer-float-drift': 'trainer-float-drift 8s ease-in-out infinite',
				'admin-row-enter': 'admin-row-enter 0.35s ease-out',
				'admin-status-pulse-emerald': 'admin-status-pulse-emerald 0.6s ease-out 1',
				'admin-status-pulse-amber': 'admin-status-pulse-amber 0.6s ease-out 1'
			}
		}
	},
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
