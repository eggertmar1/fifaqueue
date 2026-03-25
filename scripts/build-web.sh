#!/bin/bash
set -e

# Build Expo web
npx expo export --platform web

# Inject PWA meta tags into index.html
sed -i.bak 's|</head>|<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="FIFA Queue"><meta name="mobile-web-app-capable" content="yes"><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/icon-192.png"></head>|' dist/index.html

# Set dark background
sed -i.bak 's|height: 100%;|height: 100%; background-color: #121212;|' dist/index.html

# Fix viewport for safe area
sed -i.bak 's|initial-scale=1, shrink-to-fit=no|initial-scale=1, viewport-fit=cover, shrink-to-fit=no|' dist/index.html

# Clean up backup files
rm -f dist/index.html.bak

echo "Build complete with PWA support"
