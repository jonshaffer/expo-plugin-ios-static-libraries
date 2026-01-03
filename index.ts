import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';
import * as fs from 'fs';
import path from 'path';

/**
 * Configuration for a single library with optional modular headers
 */
export interface LibraryConfig {
  name: string;
  modularHeaders?: boolean;
}

/**
 * A library entry can be a simple string (pod name) or an object with options
 */
export type LibraryEntry = string | LibraryConfig;

/**
 * Plugin configuration
 */
export interface PluginConfig {
  libraries: LibraryEntry[];
}

const pluginComment = "# Added by expo-plugin-ios-static-libraries";

/**
 * Normalizes the library entries into separate arrays for static libraries and modular headers
 */
export function normalizeLibraries(libraries: LibraryEntry[]): {
  allLibraries: string[];
  modularHeaderLibraries: string[];
} {
  const allLibraries: string[] = [];
  const modularHeaderLibraries: string[] = [];

  for (const lib of libraries) {
    if (typeof lib === 'string') {
      allLibraries.push(lib);
    } else {
      allLibraries.push(lib.name);
      if (lib.modularHeaders) {
        modularHeaderLibraries.push(lib.name);
      }
    }
  }

  return { allLibraries, modularHeaderLibraries };
}

/**
 * Generates Ruby code to enable modular headers for specified libraries
 */
function generateModularHeadersCode(libraries: string[], indent: string = ''): string {
  if (libraries.length === 0) {
    return '';
  }

  const escapedLibs = libraries
    .map(lib => `'${lib.replace(/'/g, "\\'")}'`)
    .join(', ');

  return `${indent}# Enable modular headers for Swift compatibility
${indent}[${escapedLibs}].each do |lib_name|
${indent}  installer.podfile.target_definitions.each do |name, target_def|
${indent}    target_def.set_use_modular_headers_for_pod(lib_name, true)
${indent}  end
${indent}end
`;
}

/**
 * Patches a Podfile string to add static library configuration for specified libraries
 * This function is exported for testing purposes
 */
export function patchPodfile(
  podfileContent: string,
  libraries: string[] = [],
  modularHeaderLibraries: string[] = []
): string {
  // Skip if no libraries to configure
  if (libraries.length === 0) {
    return podfileContent;
  }

  // If there is already a match for this plugins comment, skip adding.
  if (podfileContent.indexOf(pluginComment) !== -1) {
    return podfileContent;
  }

  // Create condition for libraries, escaping single quotes to prevent injection
  const libraryConditions = libraries
    .map(lib => `pod.name.eql?('${lib.replace(/'/g, "\\'")}')`)
    .join(' || ');

  // Generate modular headers code if needed
  const modularHeadersCode = generateModularHeadersCode(modularHeaderLibraries, '  ');

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
${modularHeadersCode}  installer.pod_targets.each do |pod|
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
${modularHeadersCode}  installer.pod_targets.each do |pod|
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
 * specific libraries to use static build type and optionally enable modular headers
 */
const withIosStaticLibraries: ConfigPlugin<PluginConfig> = (
  config,
  { libraries = [] }
) => {
  const { allLibraries, modularHeaderLibraries } = normalizeLibraries(libraries);

  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;
      const podfilePath = path.join(platformProjectRoot, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.warn('[expo-plugin-ios-static-libraries] Podfile not found at', podfilePath);
        return config;
      }

      const podfileContent = fs.readFileSync(podfilePath, 'utf-8');
      const newPodfileContent = patchPodfile(podfileContent, allLibraries, modularHeaderLibraries);

      // Only write the file if changes were made
      if (newPodfileContent !== podfileContent) {
        fs.writeFileSync(podfilePath, newPodfileContent);
      }

      return config;
    },
  ]);
};

export default withIosStaticLibraries;
