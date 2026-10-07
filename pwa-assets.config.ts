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
      resizeOptions: { background: "#FFFFFF" },
    },
    apple: {
      ...minimal2023Preset.apple,
      // The roundel already has its own margin: little extra padding.
      padding: 0.06,
      resizeOptions: { background: "#FFFFFF" },
    },
  },
  images: ["public/icon.svg"],
});
