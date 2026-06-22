// Anchors PostCSS config resolution to this app so Vite never walks up the
// directory tree and accidentally picks up an unrelated postcss.config from a
// parent/home folder (which is what caused a stray "@tailwindcss/postcss"
// resolution error on some machines). This app uses plain CSS + inline styles —
// no Tailwind — so there are no PostCSS plugins to run.
export default { plugins: {} };
