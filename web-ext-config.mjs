// Mozilla web-ext settings for packaging and signing the Firefox build.
// Usage: npx web-ext sign --api-key=... --api-secret=...
export default {
  sourceDir: ".",
  artifactsDir: "dist",
  ignoreFiles: ["assets/**", "icons/icon.png", "README.md", "README.en.md", "sample-profile.json", "web-ext-config.mjs"],
  sign: {
    channel: "unlisted"
  }
};
