import * as fs from 'fs';
import path from 'path';

// Mock the entire @expo/config-plugins module
jest.mock('@expo/config-plugins', () => {
  return {
    withDangerousMod: jest.fn((config, [platform, modFn]) => {
      return {
        _mock_mod_fn: modFn
      };
    })
  };
});

// Mock the fs module
jest.mock('fs', () => {
  return {
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
  };
});

describe('withIosStaticLibraries', () => {
  let withIosStaticLibraries: any;
  
  // Before each test, re-import the module to get a fresh instance with clean mocks
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the writeFileSync mock to do nothing (default behavior)
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    
    // We need to re-import the module to get the newly mocked version
    jest.isolateModules(() => {
      withIosStaticLibraries = require('../index').default;
    });
  });

  const runModFunction = async (config: any, libraries: string[], podfileContent: string) => {
    // Setup existsSync and readFileSync mocks
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(podfileContent);
    
    // Call the plugin
    const result = withIosStaticLibraries(config, { libraries });
    
    // Get the mod function
    const modFn = result._mock_mod_fn;
    
    // Run the mod function
    await modFn(config);
    
    // Check if writeFileSync was called
    const wasPodfileWritten = (fs.writeFileSync as jest.Mock).mock.calls.length > 0;
    
    // Get the content that was written, if any
    const writtenContent = wasPodfileWritten 
      ? (fs.writeFileSync as jest.Mock).mock.calls[0][1] 
      : '';
    
    return {
      writtenContent,
      wasPodfileWritten
    };
  };

  it('should create a new pre_install block when none exists', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const mockPodfile = 'target \'MyApp\' do\n  # Some pod dependencies\nend';
    const libraries = ['LibraryA', 'LibraryB'];

    const { writtenContent, wasPodfileWritten } = await runModFunction(mockConfig, libraries, mockPodfile);

    expect(wasPodfileWritten).toBe(true);
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join('/mock/path', 'Podfile'), 
      'utf-8'
    );
    
    // Check that the content includes our pre_install block
    expect(writtenContent).toContain('pre_install do |installer|');
    expect(writtenContent).toContain('pod.name.eql?(\'LibraryA\') || pod.name.eql?(\'LibraryB\')');
    expect(writtenContent).toContain('Pod::BuildType.static_library');
  });

  it('should add code to existing pre_install block', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const mockPodfile = `
target 'MyApp' do
  # Some pod dependencies
end

pre_install do |installer|
  # Some existing code
  puts "Existing pre_install code"
end
`;
    const libraries = ['LibraryC'];

    const { writtenContent, wasPodfileWritten } = await runModFunction(mockConfig, libraries, mockPodfile);

    expect(wasPodfileWritten).toBe(true);
    
    // Check that we have the existing content
    expect(writtenContent).toContain('puts "Existing pre_install code"');
    
    // Check that we added our code to the existing block
    expect(writtenContent).toContain('# Added by expo-plugin-ios-static-libraries');
    expect(writtenContent).toContain('pod.name.eql?(\'LibraryC\')');
    
    // Make sure we're not creating a duplicate pre_install block
    const matches = writtenContent.match(/pre_install do \|installer\|/g);
    expect(matches?.length).toBe(1);
  });

  it('should handle empty libraries array correctly', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const mockPodfile = 'target \'MyApp\' do\n  # Some pod dependencies\nend';
    const libraries: string[] = [];

    const { writtenContent, wasPodfileWritten } = await runModFunction(mockConfig, libraries, mockPodfile);

    expect(wasPodfileWritten).toBe(true);
    
    // Check that the condition is empty or properly handled
    expect(writtenContent).toContain('if ');
    // Since the libraries array is empty, the condition should be empty
    expect(writtenContent).not.toContain('pod.name.eql?');
  });

  it('should do nothing when Podfile does not exist', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const libraries = ['LibraryA'];

    // Override the existsSync mock for this test specifically
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    // Call the plugin
    const result = withIosStaticLibraries(mockConfig, { libraries });
    const modFn = result._mock_mod_fn;
    
    // Run the mod function
    await modFn(mockConfig);
    
    // Verify writeFileSync was not called
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  // Additional tests

  it('should handle libraries with special characters in names', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const mockPodfile = 'target \'MyApp\' do\n  # Some pod dependencies\nend';
    const libraries = ['Library-With-Dashes', 'Library/With/Slashes', 'Library.With.Dots'];

    const { writtenContent } = await runModFunction(mockConfig, libraries, mockPodfile);
    
    // Check that all special character library names are properly escaped in the Ruby code
    expect(writtenContent).toContain('pod.name.eql?(\'Library-With-Dashes\')');
    expect(writtenContent).toContain('pod.name.eql?(\'Library/With/Slashes\')');
    expect(writtenContent).toContain('pod.name.eql?(\'Library.With.Dots\')');
  });

  it('should handle duplicate library names in the array', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const mockPodfile = 'target \'MyApp\' do\n  # Some pod dependencies\nend';
    const libraries = ['LibraryA', 'LibraryA', 'LibraryB', 'LibraryB'];

    const { writtenContent } = await runModFunction(mockConfig, libraries, mockPodfile);
    
    // Each library should show up in the output once, even if duplicated in input
    expect(writtenContent).toContain('pod.name.eql?(\'LibraryA\')');
    expect(writtenContent).toContain('pod.name.eql?(\'LibraryB\')');
    
    // Check that LibraryA and LibraryB are connected by an OR operator
    expect(writtenContent).toContain('||');
  });

  it('should handle complex Podfile with multiple targets', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    // Mock a more complex Podfile with multiple targets
    const mockPodfile = `
platform :ios, '12.0'
require_relative '../node_modules/react-native/scripts/react_native_pods'
require_relative '../node_modules/@react-native-community/cli-platform-ios/native_modules'

target 'MyApp' do
  config = use_native_modules!
  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => true
  )

  target 'MyAppTests' do
    inherit! :complete
    # Pods for testing
  end
end

target 'MyAppTVOS' do
  # TV target config
end

# Add post_install hook
post_install do |installer|
  react_native_post_install(installer)
  __apply_Xcode_12_5_M1_post_install_workaround(installer)
end
`;
    const libraries = ['SomeLibrary'];

    const { writtenContent } = await runModFunction(mockConfig, libraries, mockPodfile);
    
    // Check that our pre_install block is added and the original content is preserved
    expect(writtenContent).toContain('platform :ios, \'12.0\'');
    expect(writtenContent).toContain('target \'MyApp\' do');
    expect(writtenContent).toContain('target \'MyAppTests\' do');
    expect(writtenContent).toContain('target \'MyAppTVOS\' do');
    expect(writtenContent).toContain('post_install do |installer|');
    expect(writtenContent).toContain('pre_install do |installer|');
    expect(writtenContent).toContain('pod.name.eql?(\'SomeLibrary\')');
    
    // Make sure we didn't duplicate any important sections
    const postInstallMatches = (writtenContent.match(/post_install do \|installer\|/g) || []).length;
    expect(postInstallMatches).toBe(1);
  });

  it('should handle readFileSync errors gracefully', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const libraries = ['LibraryA'];

    // Setup mocks to throw error on readFileSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Mocked file read error');
    });
    
    // Call the plugin and expect an error
    let error: unknown;
    try {
      const result = withIosStaticLibraries(mockConfig, { libraries });
      await result._mock_mod_fn(mockConfig);
    } catch (e) {
      error = e;
    }
    
    // The plugin should propagate the error
    expect(error).toBeDefined();
    expect((error as Error).message).toBe('Mocked file read error');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should handle writeFileSync errors gracefully', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const mockPodfile = 'target \'MyApp\' do\n  # Some pod dependencies\nend';
    const libraries = ['LibraryA'];

    // Setup mocks
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(mockPodfile);
    
    // Override the writeFileSync mock only for this test
    const writeFileSyncMock = jest.fn().mockImplementation(() => {
      throw new Error('Mocked file write error');
    });
    (fs.writeFileSync as jest.Mock).mockImplementation(writeFileSyncMock);
    
    // Call the plugin and expect an error
    let error: unknown;
    try {
      const result = withIosStaticLibraries(mockConfig, { libraries });
      await result._mock_mod_fn(mockConfig);
    } catch (e) {
      error = e;
    }
    
    // The plugin should propagate the error
    expect(error).toBeDefined();
    expect((error as Error).message).toBe('Mocked file write error');
  });

  it('should handle extremely long library names', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    const mockPodfile = 'target \'MyApp\' do\n  # Some pod dependencies\nend';
    
    // Create an extremely long library name (could potentially cause issues in some systems)
    const longName = 'A'.repeat(500) + 'Library';
    const libraries = [longName];

    const { writtenContent } = await runModFunction(mockConfig, libraries, mockPodfile);
    
    // Check that the long library name is included in the condition
    expect(writtenContent).toContain(`pod.name.eql?('${longName}')`);
  });

  it('should work with a Podfile that has single-line pre_install', async () => {
    const mockConfig = {
      modRequest: {
        platformProjectRoot: '/mock/path'
      }
    };
    
    // Mock a Podfile with a single-line pre_install block
    const mockPodfile = `
target 'MyApp' do
  # Some pod dependencies
end

pre_install do |installer| puts "Single line pre_install" end

post_install do |installer|
  puts "Post install hook"
end
`;
    const libraries = ['LibraryE'];

    const { writtenContent } = await runModFunction(mockConfig, libraries, mockPodfile);
    
    // Check that we added our code to the existing block
    expect(writtenContent).toContain('puts "Single line pre_install"');
    expect(writtenContent).toContain('pod.name.eql?(\'LibraryE\')');
    
    // Make sure we're not creating a duplicate pre_install block
    const preInstallMatches = (writtenContent.match(/pre_install do \|installer\|/g) || []).length;
    expect(preInstallMatches).toBe(1);
  });
});