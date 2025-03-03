import { patchPodfile } from '../index';

describe('patchPodfile', () => {
  // A sample Podfile without any modifications
  const samplePodfile = `platform :ios, '10.0'

target 'MyApp' do
  # Pods for MyApp
end
`;

  // A sample Podfile with an existing pre_install block
  const podfileWithPreInstall = `platform :ios, '10.0'

target 'MyApp' do
  # Pods for MyApp
end

pre_install do |installer|
  # Some existing pre-install code
  puts "Existing pre-install hook"
end
`;

  test('should add static libraries code if not present', () => {
    const patched = patchPodfile(samplePodfile, ['TestLib']);
    // Check if the patched Podfile contains the marker inserted by the plugin.
    // Adjust the regex if the inserted marker changes.
    expect(patched).toMatch(/expo-plugin-ios-static-libraries/i);
  });

  test('should not add duplicate entries when called twice', () => {
    const patchedOnce = patchPodfile(samplePodfile, ['TestLib']);
    const patchedTwice = patchPodfile(patchedOnce, ['TestLib']);
    expect(patchedTwice).toEqual(patchedOnce);
  });

  test('should insert the plugin marker only once in the modified Podfile', () => {
    const patched = patchPodfile(samplePodfile, ['TestLib']);
    const occurrences = (patched.match(/expo-plugin-ios-static-libraries/g) || []).length;
    expect(occurrences).toEqual(1);
  });

  test('should handle empty libraries array', () => {
    const patched = patchPodfile(samplePodfile, []);
    // Should still add the marker and pre_install block
    expect(patched).toMatch(/expo-plugin-ios-static-libraries/i);
    // But the condition should be empty
    expect(patched).not.toMatch(/pod\.name\.eql\?/);
  });

  test('should add to existing pre_install block', () => {
    const patched = patchPodfile(podfileWithPreInstall, ['TestLib']);
    // Should contain both the existing code and our new code
    expect(patched).toMatch(/Existing pre-install hook/);
    expect(patched).toMatch(/expo-plugin-ios-static-libraries/i);
    expect(patched).toMatch(/pod\.name\.eql\?\('TestLib'\)/);
    
    // Should only have one pre_install block
    const preInstallMatches = (patched.match(/pre_install do \|installer\|/g) || []).length;
    expect(preInstallMatches).toBe(1);
  });
});
