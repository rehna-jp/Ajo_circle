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
        // Celo brand palette
        celo: {
          green: '#35D07F',
          gold: '#FBCC5C',
          mist: '#E7F4EF',
        },
        // GoodDollar accent
        gdollar: '#00B4D8',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #35D07F 0%, #FBCC5C 100%)',
      },
    },
  },
  plugins: [],
}

export default config
