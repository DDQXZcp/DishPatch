# AD-EYE Foxglove Studio Setup Guide

This guide documents how to clone and set up the AD-EYE Foxglove Studio repository when Git LFS files are unavailable.

## Prerequisites

- Node.js >= 16
- Git
- corepack (comes with Node.js)

## Setup Steps

### 1. Clone the Repository (Skip LFS)

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/AD-EYE/foxglove-opensource.git
cd foxglove-opensource
```

### 2. Clone the tier4 Fork (for LFS files)

The tier4 fork has some LFS files that can be used as replacements:

```bash
cd ..
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/tier4/foxglove-studio.git tier4-foxglove
```

### 3. Download Yarn Plugins

The Yarn plugins stored in LFS need to be downloaded from the official Yarn repository:

```bash
cd foxglove-opensource

# Download Yarn plugins (version 3.6.3)
curl -L -o .yarn/plugins/@yarnpkg/plugin-interactive-tools.cjs \
  https://github.com/yarnpkg/berry/raw/%40yarnpkg/cli/3.6.3/packages/plugin-interactive-tools/bin/%40yarnpkg/plugin-interactive-tools.js

curl -L -o .yarn/plugins/@yarnpkg/plugin-typescript.cjs \
  https://github.com/yarnpkg/berry/raw/%40yarnpkg/cli/3.6.3/packages/plugin-typescript/bin/%40yarnpkg/plugin-typescript.js

curl -L -o .yarn/plugins/@yarnpkg/plugin-version.cjs \
  https://github.com/yarnpkg/berry/raw/%40yarnpkg/cli/3.6.3/packages/plugin-workspace-tools/bin/%40yarnpkg/plugin-version.js

curl -L -o .yarn/plugins/@yarnpkg/plugin-workspace-tools.cjs \
  https://github.com/yarnpkg/berry/raw/%40yarnpkg/cli/3.6.3/packages/plugin-workspace-tools/bin/%40yarnpkg/plugin-workspace-tools.js
```

### 4. Download Fonts

Download the Inter and IBM Plex Mono fonts:

```bash
cd packages/studio-base/src/styles/assets

# Download Inter fonts
curl -L -o Inter-Regular.woff2 \
  "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Regular.woff2"

curl -L -o Inter-Medium.woff2 \
  "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Medium.woff2"

curl -L -o Inter-SemiBold.woff2 \
  "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-SemiBold.woff2"

curl -L -o Inter-Italic.woff2 \
  "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Italic.woff2"

curl -L -o Inter-MediumItalic.woff2 \
  "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-MediumItalic.woff2"

curl -L -o Inter-SemiBoldItalic.woff2 \
  "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-SemiBoldItalic.woff2"

# Download IBM Plex Mono fonts
curl -L -o PlexMono.woff2 \
  "https://unpkg.com/@ibm/plex@6.0.0/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2"

curl -L -o PlexMono-Bold.woff2 \
  "https://unpkg.com/@ibm/plex@6.0.0/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Bold.woff2"

curl -L -o PlexMono-Italic.woff2 \
  "https://unpkg.com/@ibm/plex@6.0.0/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Italic.woff2"

curl -L -o PlexMono-BoldItalic.woff2 \
  "https://unpkg.com/@ibm/plex@6.0.0/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-BoldItalic.woff2"

cd ../../../../..
```

### 5. Copy Additional Assets from tier4 Fork

Copy other LFS assets (thumbnails, test fixtures, icons):

```bash
# Copy panel thumbnails
find ../tier4-foxglove/packages/studio-base/src/panels -name "thumbnail.png" \
  -exec sh -c 'cp "$1" "packages/studio-base/src/panels/$(basename $(dirname "$1"))/"' _ {} \;

# Copy diagnostics thumbnails
cp ../tier4-foxglove/packages/studio-base/src/panels/diagnostics/thumbnails/*.png \
  packages/studio-base/src/panels/diagnostics/thumbnails/

# Copy component images
cp ../tier4-foxglove/packages/studio-base/src/components/WssErrorModal.png \
  packages/studio-base/src/components/

# Copy test fixtures
cp ../tier4-foxglove/packages/studio-base/src/test/fixtures/*.bag \
  packages/studio-base/src/test/fixtures/

# Copy web assets (favicons, icons)
cp ../tier4-foxglove/packages/studio-web/public/*.png packages/studio-web/public/
cp ../tier4-foxglove/packages/studio-web/public/*.ico packages/studio-web/public/

# Copy resources
cp ../tier4-foxglove/resources/screenshot.png resources/
```

### 6. Enable Corepack and Install Dependencies

```bash
corepack enable
YARN_CHECKSUM_BEHAVIOR=update yarn install
```

### 7. Run the Development Server

```bash
yarn web:serve
```

The app will be available at http://localhost:8080

## Notes

- The `GIT_LFS_SKIP_SMUDGE=1` flag tells Git to skip downloading LFS files, leaving only pointer files
- The `YARN_CHECKSUM_BEHAVIOR=update` flag updates checksums for packages that have mismatches
- You may see React 18 warnings in the console - these are harmless and don't affect functionality
- The "No coordinate frames found" warning is expected when no robotics data is loaded

## Troubleshooting

### "command not found: yarn"
Make sure corepack is enabled:
```bash
corepack enable
```

### Font decode errors in browser
Make sure all fonts were downloaded correctly and are not HTML files:
```bash
file packages/studio-base/src/styles/assets/Inter-Regular.woff2
# Should output: "Web Open Font Format (Version 2)"
```

### Checksum errors during install
Use the `YARN_CHECKSUM_BEHAVIOR=update` flag:
```bash
YARN_CHECKSUM_BEHAVIOR=update yarn install
```
