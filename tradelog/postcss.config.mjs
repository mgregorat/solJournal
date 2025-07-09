import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/** @type {import('postcss').Config} */
const config = {
  plugins: [
    tailwindcss,
    autoprefixer,
  ],
};

export default config;
