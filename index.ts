import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';
import * as fs from 'fs';
import path from 'path';

/**
 * Config plugin that adds pre_install hook to the iOS Podfile to set
 * specific libraries to use static build type
 */
const withIosStaticLibraries: ConfigPlugin<{ libraries: string[] }> = (
  config,
  { libraries = [] }
) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;
      const podfilePath = path.join(platformProjectRoot, 'Podfile');
      
      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf-8');
        
        // Create condition for libraries
        const libraryConditions = libraries
          .map(lib => `pod.name.eql?('${lib}')`)
          .join(' || ');
        
        // Check if pre_install block already exists
        const preInstallRegex = /pre_install\s+do\s+\|installer\|([\s\S]*?)end/;
        const preInstallMatch = podfileContent.match(preInstallRegex);
        
        if (preInstallMatch) {
          // There's an existing pre_install block, add our code to the end of it
          const existingContent = preInstallMatch[0];
          const insertPoint = existingContent.lastIndexOf('end');
          
          const codeToAdd = `
  # Added by expo-plugin-ios-static-libraries
  installer.pod_targets.each do |pod|
    if ${libraryConditions}
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
`;
          
          // Insert our code before the last 'end'
          const newContent = existingContent.slice(0, insertPoint) + codeToAdd + existingContent.slice(insertPoint);
          podfileContent = podfileContent.replace(existingContent, newContent);
        } else {
          // No existing pre_install block, create a new one
          const preInstallBlock = `
# Added by expo-plugin-ios-static-libraries
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if ${libraryConditions}
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
end
`;
          // Append the pre_install hook to the end of the Podfile
          podfileContent += `\n${preInstallBlock}\n`;
        }
        
        fs.writeFileSync(podfilePath, podfileContent);
      }

      return config;
    },
  ]);
};

export default withIosStaticLibraries;