import {
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

// Generates the PWA icons in public/ from public/icon.svg.
// Run `npm run icons:build` after changing the SVG and commit the PNGs.
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: "#DA1A32" },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: "#DA1A32" },
    },
  },
  images: ["public/icon.svg"],
});
