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

PROJECTS=("expo-54-firebase" "expo-54-sqlite" "expo-mixed")

# Parse arguments
WITH_POD_INSTALL=false
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --with-pod-install) WITH_POD_INSTALL=true ;;
    *) echo "Unknown parameter: $1"; echo "Usage: $0 [--with-pod-install]"; exit 1 ;;
  esac
  shift
done

SECONDS=0

echo -e "${YELLOW}=== expo-plugin-ios-static-libraries Integration Tests ===${NC}"
echo ""

# Build and link the plugin first
echo -e "${YELLOW}Building and linking plugin...${NC}"
cd "$ROOT_DIR"
pnpm build
pnpm link --global
echo -e "${GREEN}Plugin linked globally${NC}"
echo ""

# Track results per project
declare -A RESULTS

# ============================================
# Project-specific Podfile assertions
# ============================================
verify_firebase() {
  local podfile="$1"
  local errors=0

  # Must have modular headers section
  if ! grep -q "set_use_modular_headers_for_pod" "$podfile"; then
    echo -e "    ${RED}Missing: modular headers section${NC}"
    ((errors++))
  fi

  # Must have all 14 libraries in the static block (12 Firebase + 2 Google Maps)
  for lib in FirebaseCore FirebaseAuth FirebaseFirestore FirebaseCoreInternal \
             FirebaseSharedSwift GTMSessionFetcher FirebaseAuthInterop \
             FirebaseAppCheckInterop FirebaseCoreExtension GoogleUtilities \
             RecaptchaInterop FirebaseFirestoreInternal GoogleMaps Google-Maps-iOS-Utils; do
    if ! grep -q "pod.name.eql?('$lib')" "$podfile"; then
      echo -e "    ${RED}Missing library in static block: $lib${NC}"
      ((errors++))
    fi
  done

  # Must have all 14 in modular headers array
  for lib in FirebaseCore FirebaseAuth FirebaseFirestore FirebaseCoreInternal \
             FirebaseSharedSwift GTMSessionFetcher FirebaseAuthInterop \
             FirebaseAppCheckInterop FirebaseCoreExtension GoogleUtilities \
             RecaptchaInterop FirebaseFirestoreInternal GoogleMaps Google-Maps-iOS-Utils; do
    if ! grep "set_use_modular_headers_for_pod" "$podfile" | grep -q "'$lib'"; then
      echo -e "    ${RED}Missing library in modular headers: $lib${NC}"
      ((errors++))
    fi
  done

  return $errors
}

verify_sqlite() {
  local podfile="$1"
  local errors=0

  # Must have op-sqlite in static block
  if ! grep -q "pod.name.eql?('op-sqlite')" "$podfile"; then
    echo -e "    ${RED}Missing: op-sqlite in static block${NC}"
    ((errors++))
  fi

  # Must NOT have modular headers section
  if grep -q "set_use_modular_headers_for_pod" "$podfile"; then
    echo -e "    ${RED}Unexpected: modular headers section should not be present${NC}"
    ((errors++))
  fi

  return $errors
}

verify_mixed() {
  local podfile="$1"
  local errors=0

  # Must have both libraries in static block
  if ! grep -q "pod.name.eql?('RNPermissions')" "$podfile"; then
    echo -e "    ${RED}Missing: RNPermissions in static block${NC}"
    ((errors++))
  fi
  if ! grep -q "pod.name.eql?('RNScreens')" "$podfile"; then
    echo -e "    ${RED}Missing: RNScreens in static block${NC}"
    ((errors++))
  fi

  # Must have modular headers section (for RNScreens)
  if ! grep -q "set_use_modular_headers_for_pod" "$podfile"; then
    echo -e "    ${RED}Missing: modular headers section${NC}"
    ((errors++))
  fi

  # RNScreens must be in modular headers
  if ! grep "set_use_modular_headers_for_pod" "$podfile" | grep -q "'RNScreens'"; then
    echo -e "    ${RED}Missing: RNScreens in modular headers${NC}"
    ((errors++))
  fi

  # RNPermissions must NOT be in modular headers
  if grep "set_use_modular_headers_for_pod" "$podfile" | grep -q "'RNPermissions'"; then
    echo -e "    ${RED}Unexpected: RNPermissions should not have modular headers${NC}"
    ((errors++))
  fi

  return $errors
}

# ============================================
# Run tests for each project
# ============================================
passed=0
failed=0
skipped=0

for project in "${PROJECTS[@]}"; do
  project_dir="$TEST_PROJECTS_DIR/$project"

  if [ ! -d "$project_dir" ]; then
    echo -e "${YELLOW}⏭ Skipping $project (not created yet — run setup-projects.sh first)${NC}"
    RESULTS[$project]="SKIP"
    ((skipped++))
    continue
  fi

  echo -e "${YELLOW}Testing $project...${NC}"
  cd "$project_dir"

  # Link the plugin
  pnpm link --global expo-plugin-ios-static-libraries 2>/dev/null || npm link expo-plugin-ios-static-libraries 2>/dev/null || true

  # Run prebuild
  if ! npx expo prebuild --platform ios --clean 2>&1; then
    echo -e "${RED}✗ $project failed — prebuild error${NC}"
    RESULTS[$project]="FAIL (prebuild)"
    ((failed++))
    echo ""
    continue
  fi

  # Check plugin marker
  if ! grep -q "expo-plugin-ios-static-libraries" ios/Podfile 2>/dev/null; then
    echo -e "${RED}✗ $project failed — plugin marker not found in Podfile${NC}"
    RESULTS[$project]="FAIL (no marker)"
    ((failed++))
    echo ""
    continue
  fi

  # Run project-specific Podfile assertions
  podfile="ios/Podfile"
  verify_errors=0

  case "$project" in
    "expo-54-firebase") verify_firebase "$podfile" || verify_errors=$? ;;
    "expo-54-sqlite")   verify_sqlite "$podfile"   || verify_errors=$? ;;
    "expo-mixed")       verify_mixed "$podfile"    || verify_errors=$? ;;
  esac

  if [ "$verify_errors" -gt 0 ]; then
    echo -e "${RED}✗ $project failed — $verify_errors Podfile assertion(s) failed${NC}"
    RESULTS[$project]="FAIL ($verify_errors assertions)"
    ((failed++))
    echo ""
    continue
  fi

  # Optional pod install
  if [ "$WITH_POD_INSTALL" = true ]; then
    echo "  Running pod install..."
    if (cd ios && pod install --repo-update 2>&1); then
      echo -e "  ${GREEN}✓ pod install succeeded${NC}"
    else
      echo -e "${RED}✗ $project failed — pod install error${NC}"
      RESULTS[$project]="FAIL (pod install)"
      ((failed++))
      echo ""
      continue
    fi
  fi

  echo -e "${GREEN}✓ $project passed${NC}"
  RESULTS[$project]="PASS"
  ((passed++))

  # Show what was added to Podfile
  echo "  Podfile modifications:"
  grep -A 25 "# Added by expo-plugin-ios-static-libraries" ios/Podfile 2>/dev/null | head -30 | sed 's/^/    /'

  echo ""
done

# ============================================
# Summary
# ============================================
elapsed=$SECONDS
echo -e "${YELLOW}=== Results ===${NC}"
for project in "${PROJECTS[@]}"; do
  status="${RESULTS[$project]}"
  case "$status" in
    PASS)  color="$GREEN" ;;
    SKIP*) color="$YELLOW" ;;
    *)     color="$RED" ;;
  esac
  printf "  %-25s ${color}%s${NC}\n" "$project" "$status"
done
echo ""
echo -e "Passed: ${GREEN}$passed${NC}  Failed: ${RED}$failed${NC}  Skipped: ${YELLOW}$skipped${NC}"
echo -e "Elapsed: ${elapsed}s"

if [ $failed -gt 0 ]; then
  exit 1
fi

echo ""
echo -e "${GREEN}All tests passed!${NC}"
