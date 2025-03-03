import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';
import * as fs from 'fs';
import path from 'path';

const pluginComment = "# Added by expo-plugin-ios-static-libraries";

/**
 * Patches a Podfile string to add static library configuration for specified libraries
 * This function is exported for testing purposes
 */
export function patchPodfile(podfileContent: string, libraries: string[] = []): string {
  // If there is already a match for this plugins comment, skip adding.
  if (podfileContent.indexOf(pluginComment) !== -1) {
    return podfileContent;
  }
  
  // Create condition for libraries
  let libraryConditions = '';
  if (libraries.length > 0) {
    libraryConditions = libraries
      .map(lib => `pod.name.eql?('${lib}')`)
      .join(' || ');
  } else {
    // If no libraries specified, use a condition that's always false
    // This ensures the code is syntactically valid but won't affect any libraries
    libraryConditions = 'false';
  }
  
  // Check if pre_install block already exists
  const preInstallRegex = /pre_install\s+do\s+\|installer\|([\s\S]*?)end/;
  const preInstallMatch = podfileContent.match(preInstallRegex);
  
  let newPodfileContent = podfileContent;
  
  if (preInstallMatch) {
    // There's an existing pre_install block, add our code to the end of it
    const existingContent = preInstallMatch[0];
    const insertPoint = existingContent.lastIndexOf('end');
    
    const codeToAdd = `
  ${pluginComment}
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
    newPodfileContent = podfileContent.replace(existingContent, newContent);
  } else {
    // No existing pre_install block, create a new one
    const preInstallBlock = `
${pluginComment}
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
    newPodfileContent += `\n${preInstallBlock}\n`;
  }
  
  return newPodfileContent;
}

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
        const podfileContent = fs.readFileSync(podfilePath, 'utf-8');
        const newPodfileContent = patchPodfile(podfileContent, libraries);
        
        // Only write the file if changes were made
        if (newPodfileContent !== podfileContent) {
          fs.writeFileSync(podfilePath, newPodfileContent);
        }
      }

      return config;
    },
  ]);
};

export default withIosStaticLibraries;
