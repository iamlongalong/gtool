#!/bin/bash

# GitHub Clone & Open - Server Launcher

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         GitHub Clone & Open - Server Launcher              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo ""
    echo "Please install Node.js first:"
    echo "  - macOS: brew install node"
    echo "  - Ubuntu: sudo apt install nodejs npm"
    echo "  - Or download from: https://nodejs.org/"
    echo ""
    exit 1
fi

# Display Node.js version
NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"
echo ""

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the project directory"
    exit 1
fi

echo "🚀 Starting server..."
echo ""

USE_HTTPS=true node server.js
