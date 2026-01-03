# Expo Plugin iOS Static Libraries

An Expo Config Plugin that allows you to set specific iOS libraries to use static build type. This helps resolve issues with dynamic library dependencies in your iOS builds.

## Compatibility

| Expo SDK | Supported |
|----------|-----------|
| 54       | Yes       |
| 53       | Yes       |
| 52       | Yes       |
| < 52     | No        |

## Installation

```bash
npm install expo-plugin-ios-static-libraries
# or
yarn add expo-plugin-ios-static-libraries
# or
bun add expo-plugin-ios-static-libraries
```

## Usage

Add the plugin to your `app.json` or `app.config.js`:

### Basic Usage (String Format)

For simple cases where modular headers are not needed:

```json
{
  "name": "my-app",
  "expo": {
    "plugins": [
      [
        "expo-plugin-ios-static-libraries",
        {
          "libraries": ["LibraryName", "AnotherLibraryName"]
        }
      ]
    ]
  }
}
```

### Swift Pods with Modular Headers

For Swift-based pods (like Firebase), you may need to enable modular headers to avoid `'*-Swift.h' file not found` errors:

```json
{
  "name": "my-app",
  "expo": {
    "plugins": [
      [
        "expo-plugin-ios-static-libraries",
        {
          "libraries": [
            "BleManager",
            { "name": "Firebase", "modularHeaders": true },
            { "name": "FirebaseAuth", "modularHeaders": true },
            { "name": "GTMSessionFetcher", "modularHeaders": true }
          ]
        }
      ]
    ]
  }
}
```

### When to Use Modular Headers

Enable `modularHeaders: true` when you see errors like:
- `'FirebaseAuth/FirebaseAuth-Swift.h' file not found`
- `Include of non-modular header inside framework module`
- Swift bridging header errors

Not all pods need modular headers. Only enable it for pods that:
1. Are written in Swift, or
2. Have Swift dependencies, or
3. Show module-related build errors

## Example

Here's an example of how to set React-Native-BLE-PLX, react-native-permissions, and @op-engineering/op-sqlite to use static libraries:

```json
{
  "name": "my-app",
  "expo": {
    "plugins": [
      [
        "expo-plugin-ios-static-libraries",
        {
          "libraries": ["BleManager", "RNPermissions", "op-sqlite"]
        }
      ]
    ]
  }
}
```

## How it Works

This plugin uses Expo Config Plugins to modify the Podfile during the build process. It adds a `pre_install` hook that:

1. **Sets static library build type** for specified libraries
2. **Enables modular headers** for libraries that need them (using CocoaPods' `set_use_modular_headers_for_pod` API)

The generated code looks like:

```ruby
pre_install do |installer|
  # Enable modular headers for Swift compatibility
  ['Firebase', 'FirebaseAuth'].each do |lib_name|
    installer.podfile.target_definitions.each do |name, target_def|
      target_def.set_use_modular_headers_for_pod(lib_name, true)
    end
  end

  # Set static library build type
  installer.pod_targets.each do |pod|
    if pod.name.eql?('BleManager') || pod.name.eql?('Firebase') || pod.name.eql?('FirebaseAuth')
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
end
```

This forces CocoaPods to build the specified libraries as static libraries instead of dynamic frameworks, which can help resolve dependency issues in some cases.

## Troubleshooting

### Swift Header Not Found Errors

If you see errors like `'SomePod/SomePod-Swift.h' file not found`, try enabling modular headers for that pod:

```json
{ "name": "SomePod", "modularHeaders": true }
```

### gRPC Module Map Errors

If enabling modular headers causes gRPC-related errors, ensure you're only enabling modular headers for the specific pods that need it, not globally.

## License

MIT
