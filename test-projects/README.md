# Integration Test Projects

This directory contains Expo projects for testing `expo-plugin-ios-static-libraries` against real-world configurations.

## Test Projects

| Project | Config Format | Libraries | Feature Tested |
|---------|--------------|-----------|----------------|
| `expo-54-firebase` | Objects with `modularHeaders: true` | 14 Firebase + Google Maps pods | modularHeaders, many libraries |
| `expo-54-sqlite` | Simple strings | `op-sqlite` | Basic string format, single library |
| `expo-mixed` | Mixed strings + objects | `RNPermissions` (string) + `RNScreens` (object) | Mixed config types together |

## Quick Start

### 1. Setup Test Projects

```bash
# Create all test projects
./scripts/setup-projects.sh

# Or create a specific project
./scripts/setup-projects.sh firebase
./scripts/setup-projects.sh sqlite
./scripts/setup-projects.sh mixed
```

### 2. Link the Plugin

```bash
# From the plugin root directory
pnpm build
pnpm link --global
```

### 3. Run Tests

```bash
# Prebuild + Podfile verification only
./scripts/test-all.sh

# Also run pod install for each project
./scripts/test-all.sh --with-pod-install
```

## Manual Testing

### Test a Single Project

```bash
cd test-projects/expo-54-firebase
pnpm link --global expo-plugin-ios-static-libraries
npx expo prebuild --platform ios --clean
```

### Verify Podfile Changes

After prebuild, check the generated Podfile:

```bash
cat ios/Podfile | grep -A 30 "expo-plugin-ios-static-libraries"
```

Expected output for the Firebase project (modular headers):
```ruby
# Added by expo-plugin-ios-static-libraries
pre_install do |installer|
  # Enable modular headers for Swift compatibility
  ['FirebaseCore', 'FirebaseAuth', ...].each do |lib_name|
    installer.podfile.target_definitions.each do |name, target_def|
      target_def.set_use_modular_headers_for_pod(lib_name, true)
    end
  end

  installer.pod_targets.each do |pod|
    if pod.name.eql?('FirebaseCore') || pod.name.eql?('FirebaseAuth') || ...
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
end
```

### Full iOS Build Test

```bash
cd test-projects/expo-54-firebase/ios
pod install
xcodebuild -workspace expo54firebase.xcworkspace -scheme expo54firebase -configuration Debug -sdk iphonesimulator
```

## Validation Checklist

For each test project, verify:

- [ ] `expo prebuild --platform ios` succeeds
- [ ] Podfile contains `# Added by expo-plugin-ios-static-libraries`
- [ ] Podfile has correct `pre_install` block
- [ ] For modular headers projects: `set_use_modular_headers_for_pod` is present
- [ ] `pod install` succeeds (in ios/ directory)
- [ ] iOS build compiles (optional — requires Xcode)

## Known Limitations

- These are **manual tests**, not run in CI. They require macOS and optionally CocoaPods/Xcode.
- Backward compatibility with older Expo SDK versions is tested via unit tests in CI, not integration tests.
- `pod install` and Xcode builds require macOS with CocoaPods and Xcode installed.
- Projects should be re-created (delete and re-run `setup-projects.sh`) when the Expo SDK version changes.
- The Firebase project uses a placeholder `GoogleService-Info.plist` — Xcode builds may fail at runtime without real credentials.

## Troubleshooting

### Plugin not found

Make sure you've linked the plugin globally:
```bash
cd /path/to/expo-plugin-ios-static-libraries
pnpm build
pnpm link --global
```

### Prebuild fails

Check that the plugin is properly linked:
```bash
ls -la node_modules/expo-plugin-ios-static-libraries
```

### Firebase build errors

For Firebase Swift header issues, ensure all required pods have `modularHeaders: true` in the plugin config. The full list of required pods may change between Firebase versions.
