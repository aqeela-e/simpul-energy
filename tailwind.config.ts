import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-deep': '#0A0F1E',
        'bg-card': '#1A2744',
        'bg-border': '#2A3F6F',
        'accent-teal': '#0D7C66',
        'accent-amber': '#F0A500',
        'text-primary': '#E8F4F1',
        'text-muted': '#8FA8B8',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
