import { patchPodfile, normalizeLibraries, LibraryEntry } from '../index';

describe('normalizeLibraries', () => {
  test('should handle string libraries', () => {
    const libraries: LibraryEntry[] = ['LibA', 'LibB'];
    const result = normalizeLibraries(libraries);
    expect(result.allLibraries).toEqual(['LibA', 'LibB']);
    expect(result.modularHeaderLibraries).toEqual([]);
  });

  test('should handle object libraries without modularHeaders', () => {
    const libraries: LibraryEntry[] = [{ name: 'LibA' }, { name: 'LibB' }];
    const result = normalizeLibraries(libraries);
    expect(result.allLibraries).toEqual(['LibA', 'LibB']);
    expect(result.modularHeaderLibraries).toEqual([]);
  });

  test('should handle object libraries with modularHeaders', () => {
    const libraries: LibraryEntry[] = [
      { name: 'LibA', modularHeaders: true },
      { name: 'LibB', modularHeaders: false },
      { name: 'LibC', modularHeaders: true },
    ];
    const result = normalizeLibraries(libraries);
    expect(result.allLibraries).toEqual(['LibA', 'LibB', 'LibC']);
    expect(result.modularHeaderLibraries).toEqual(['LibA', 'LibC']);
  });

  test('should handle mixed string and object libraries', () => {
    const libraries: LibraryEntry[] = [
      'BleManager',
      { name: 'Firebase', modularHeaders: true },
      { name: 'GTMSessionFetcher', modularHeaders: true },
    ];
    const result = normalizeLibraries(libraries);
    expect(result.allLibraries).toEqual(['BleManager', 'Firebase', 'GTMSessionFetcher']);
    expect(result.modularHeaderLibraries).toEqual(['Firebase', 'GTMSessionFetcher']);
  });

  test('should handle empty array', () => {
    const result = normalizeLibraries([]);
    expect(result.allLibraries).toEqual([]);
    expect(result.modularHeaderLibraries).toEqual([]);
  });
});

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

  test('should return unchanged content for empty libraries array', () => {
    const patched = patchPodfile(samplePodfile, []);
    // Should return the original content unchanged
    expect(patched).toBe(samplePodfile);
    // Should not add any plugin markers
    expect(patched).not.toMatch(/expo-plugin-ios-static-libraries/i);
  });

  test('should escape single quotes in library names', () => {
    const patched = patchPodfile(samplePodfile, ["Test'Lib"]);
    // Should contain escaped quote
    expect(patched).toMatch(/pod\.name\.eql\?\('Test\\'Lib'\)/);
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

describe('patchPodfile with modular headers', () => {
  const samplePodfile = `platform :ios, '10.0'

target 'MyApp' do
  # Pods for MyApp
end
`;

  test('should not add modular headers code when modularHeaderLibraries is empty', () => {
    const patched = patchPodfile(samplePodfile, ['TestLib'], []);
    expect(patched).not.toMatch(/set_use_modular_headers_for_pod/);
    expect(patched).toMatch(/Pod::BuildType\.static_library/);
  });

  test('should add modular headers code when modularHeaderLibraries is provided', () => {
    const patched = patchPodfile(samplePodfile, ['Firebase'], ['Firebase']);
    expect(patched).toMatch(/set_use_modular_headers_for_pod/);
    expect(patched).toMatch(/\['Firebase'\]/);
    expect(patched).toMatch(/target_definitions/);
  });

  test('should handle multiple modular header libraries', () => {
    const patched = patchPodfile(
      samplePodfile,
      ['Firebase', 'GTMSessionFetcher'],
      ['Firebase', 'GTMSessionFetcher']
    );
    expect(patched).toMatch(/\['Firebase', 'GTMSessionFetcher'\]/);
    expect(patched).toMatch(/set_use_modular_headers_for_pod/);
  });

  test('should handle mixed libraries (some with modular headers, some without)', () => {
    const patched = patchPodfile(
      samplePodfile,
      ['BleManager', 'Firebase', 'GTMSessionFetcher'],
      ['Firebase', 'GTMSessionFetcher']
    );
    // All should be in static library conditions
    expect(patched).toMatch(/pod\.name\.eql\?\('BleManager'\)/);
    expect(patched).toMatch(/pod\.name\.eql\?\('Firebase'\)/);
    expect(patched).toMatch(/pod\.name\.eql\?\('GTMSessionFetcher'\)/);
    // Only Firebase and GTMSessionFetcher should have modular headers
    expect(patched).toMatch(/\['Firebase', 'GTMSessionFetcher'\]\.each do \|lib_name\|/);
    expect(patched).not.toMatch(/\['BleManager'\]\.each/);
  });

  test('should escape single quotes in modular header library names', () => {
    const patched = patchPodfile(samplePodfile, ["Test'Lib"], ["Test'Lib"]);
    expect(patched).toMatch(/\['Test\\'Lib'\]/);
  });

  test('should place modular headers code before static library code', () => {
    const patched = patchPodfile(samplePodfile, ['Firebase'], ['Firebase']);
    const modularHeadersIndex = patched.indexOf('set_use_modular_headers_for_pod');
    const staticLibraryIndex = patched.indexOf('Pod::BuildType.static_library');
    expect(modularHeadersIndex).toBeLessThan(staticLibraryIndex);
  });
});
