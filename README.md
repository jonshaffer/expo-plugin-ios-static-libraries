# Expo Plugin iOS Static Libraries

An Expo Config Plugin that allows you to set specific iOS libraries to use static build type. This helps resolve issues with dynamic library dependencies in your iOS builds.

## Installation

```bash
npm install expo-plugin-ios-static-libraries
# or
yarn add expo-plugin-ios-static-libraries
```

## Usage

Add the plugin to your `app.json` or `app.config.js`:

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

This plugin uses Expo Config Plugins to modify the Podfile during the build process. It adds a `pre_install` hook to the Podfile that sets the build type of the specified libraries to static. The generated code looks like:

```ruby
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if pod.name.eql?('LibraryName') || pod.name.eql?('AnotherLibraryName')
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
end
```

This forces CocoaPods to build the specified libraries as static libraries instead of dynamic frameworks, which can help resolve dependency issues in some cases.

## License

MIT
