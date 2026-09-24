// NOTE: Tailwind CSS v4 (@tailwindcss/postcss) already handles vendor
// prefixing via Lightning CSS, so no explicit `autoprefixer` plugin is
// required here. Keeping the config minimal avoids a hard runtime
// dependency on `node_modules/autoprefixer` (which broke `npm run build`
// on servers where `npm install` was not re-run after pull).
// Browser compatibility is achieved via `browserslist` in package.json
// plus manual CSS fallbacks (@media/@supports, -webkit- prefixes).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
