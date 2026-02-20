#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_PROJECTS_DIR="$ROOT_DIR/test-projects"

# Dependency checks
for cmd in node npx; do
  if ! command -v "$cmd" &> /dev/null; then
    echo -e "${RED}Error: $cmd is not installed${NC}"
    exit 1
  fi
done

echo -e "${YELLOW}=== Setting up test projects ===${NC}"
echo ""

mkdir -p "$TEST_PROJECTS_DIR"
cd "$TEST_PROJECTS_DIR"

# ============================================
# expo-54-firebase - Firebase + Google Maps with modular headers
# ============================================
setup_firebase() {
  local project="expo-54-firebase"
  echo -e "${YELLOW}Creating $project...${NC}"

  if [ -d "$project" ]; then
    echo -e "${YELLOW}  $project already exists, skipping creation${NC}"
    return
  fi

  npx create-expo-app@latest "$project" --template blank-typescript
  cd "$project"

  # Install Firebase dependencies
  npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore

  # Install Google Maps
  npx expo install react-native-maps

  # Update app.json with plugin configuration
  cat > app.json << 'EOF'
{
  "expo": {
    "name": "expo-54-firebase",
    "slug": "expo-54-firebase",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.test.expo54firebase",
      "googleServicesFile": "./GoogleService-Info.plist",
      "config": {
        "googleMapsApiKey": "PLACEHOLDER_API_KEY"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      [
        "expo-plugin-ios-static-libraries",
        {
          "libraries": [
            { "name": "FirebaseCore", "modularHeaders": true },
            { "name": "FirebaseAuth", "modularHeaders": true },
            { "name": "FirebaseFirestore", "modularHeaders": true },
            { "name": "FirebaseCoreInternal", "modularHeaders": true },
            { "name": "FirebaseSharedSwift", "modularHeaders": true },
            { "name": "GTMSessionFetcher", "modularHeaders": true },
            { "name": "FirebaseAuthInterop", "modularHeaders": true },
            { "name": "FirebaseAppCheckInterop", "modularHeaders": true },
            { "name": "FirebaseCoreExtension", "modularHeaders": true },
            { "name": "GoogleUtilities", "modularHeaders": true },
            { "name": "RecaptchaInterop", "modularHeaders": true },
            { "name": "FirebaseFirestoreInternal", "modularHeaders": true },
            { "name": "GoogleMaps", "modularHeaders": true },
            { "name": "Google-Maps-iOS-Utils", "modularHeaders": true }
          ]
        }
      ]
    ]
  }
}
EOF

  # Create placeholder GoogleService-Info.plist
  cat > GoogleService-Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CLIENT_ID</key>
  <string>placeholder.apps.googleusercontent.com</string>
  <key>REVERSED_CLIENT_ID</key>
  <string>com.googleusercontent.apps.placeholder</string>
  <key>API_KEY</key>
  <string>placeholder</string>
  <key>GCM_SENDER_ID</key>
  <string>000000000000</string>
  <key>PLIST_VERSION</key>
  <string>1</string>
  <key>BUNDLE_ID</key>
  <string>com.test.expo54firebase</string>
  <key>PROJECT_ID</key>
  <string>placeholder-project</string>
  <key>STORAGE_BUCKET</key>
  <string>placeholder-project.appspot.com</string>
  <key>IS_ADS_ENABLED</key>
  <false/>
  <key>IS_ANALYTICS_ENABLED</key>
  <false/>
  <key>IS_APPINVITE_ENABLED</key>
  <true/>
  <key>IS_GCM_ENABLED</key>
  <true/>
  <key>IS_SIGNIN_ENABLED</key>
  <true/>
  <key>GOOGLE_APP_ID</key>
  <string>1:000000000000:ios:placeholder</string>
</dict>
</plist>
EOF

  cd ..
  echo -e "${GREEN}✓ $project created${NC}"
}

# ============================================
# expo-54-sqlite - op-sqlite (simple string config)
# ============================================
setup_sqlite() {
  local project="expo-54-sqlite"
  echo -e "${YELLOW}Creating $project...${NC}"

  if [ -d "$project" ]; then
    echo -e "${YELLOW}  $project already exists, skipping creation${NC}"
    return
  fi

  npx create-expo-app@latest "$project" --template blank-typescript
  cd "$project"

  # Install op-sqlite
  npx expo install @op-engineering/op-sqlite

  # Update app.json with plugin configuration
  cat > app.json << 'EOF'
{
  "expo": {
    "name": "expo-54-sqlite",
    "slug": "expo-54-sqlite",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.test.expo54sqlite"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "plugins": [
      [
        "expo-plugin-ios-static-libraries",
        {
          "libraries": ["op-sqlite"]
        }
      ]
    ]
  }
}
EOF

  cd ..
  echo -e "${GREEN}✓ $project created${NC}"
}

# ============================================
# expo-mixed - Mixed string + object config
# ============================================
setup_mixed() {
  local project="expo-mixed"
  echo -e "${YELLOW}Creating $project...${NC}"

  if [ -d "$project" ]; then
    echo -e "${YELLOW}  $project already exists, skipping creation${NC}"
    return
  fi

  npx create-expo-app@latest "$project" --template blank-typescript
  cd "$project"

  # Install dependencies
  npx expo install react-native-permissions react-native-screens

  # Update app.json with plugin configuration
  cat > app.json << 'EOF'
{
  "expo": {
    "name": "expo-mixed",
    "slug": "expo-mixed",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.test.expomixed"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "plugins": [
      [
        "react-native-permissions",
        {
          "iosPermissions": ["Camera"]
        }
      ],
      [
        "expo-plugin-ios-static-libraries",
        {
          "libraries": [
            "RNPermissions",
            { "name": "RNScreens", "modularHeaders": true }
          ]
        }
      ]
    ]
  }
}
EOF

  cd ..
  echo -e "${GREEN}✓ $project created${NC}"
}

# ============================================
# Run setup functions
# ============================================

if [ -n "$1" ]; then
  case "$1" in
    "firebase")
      setup_firebase
      ;;
    "sqlite")
      setup_sqlite
      ;;
    "mixed")
      setup_mixed
      ;;
    *)
      echo "Unknown project: $1"
      echo "Usage: $0 [firebase|sqlite|mixed]"
      exit 1
      ;;
  esac
else
  # Setup all projects
  setup_firebase
  setup_sqlite
  setup_mixed
fi

echo ""
echo -e "${GREEN}=== Setup complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Link the plugin: cd $ROOT_DIR && pnpm build && pnpm link --global"
echo "  2. In each project: pnpm link --global expo-plugin-ios-static-libraries"
echo "  3. Run tests: ./scripts/test-all.sh"
