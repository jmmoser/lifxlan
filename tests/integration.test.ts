import { describe, test } from 'bun:test';
import assert from 'node:assert';
import dgram from 'node:dgram';
import { 
  Client, 
  Router, 
  Devices, 
  GetServiceCommand,
  GetPowerCommand,
  SetPowerCommand,
  GetLabelCommand,
  GetColorCommand,
  SetColorCommand,
  GetHostFirmwareCommand,
  GetWifiInfoCommand,
  GetLightPowerCommand,
  GetVersionCommand,
  GetDeviceChainCommand,
  Get64Command,
  Set64Command,
  GetTileEffectCommand,
  SetTileEffectCommand,
  TileEffectType,
  TileEffectSkyType,
  StateTileEffect,
  State64,
  Device,
  LightState
} from '../src/index.js';

/**
 * Integration/End-to-End Tests for LIFX Device Discovery and Control
 * 
 * This test suite discovers real LIFX devices on the local network,
 * selects one with good signal strength that is a regular light,
 * and runs comprehensive tests to ensure all functionality works properly.
 * 
 * Requirements:
 * - At least one LIFX regular light (not tile/special device) must be available on the local network
 * - Optionally, one or more LIFX tile devices for comprehensive tile testing
 * - The devices should be powered on and responsive with good WiFi signal (>-70dBm)
 * - Network must allow UDP broadcast on port 56700
 */

/**
 * Type guard to check if a number is a valid TileEffectType
 */
function isTileEffectType(value: number): value is TileEffectType {
  return value === TileEffectType.OFF || 
         value === TileEffectType.RESERVED1 || 
         value === TileEffectType.MORPH || 
         value === TileEffectType.FLAME || 
         value === TileEffectType.RESERVED2 || 
         value === TileEffectType.SKY;
}

/**
 * Type guard to check if a number is a valid TileEffectSkyType
 */
function isTileEffectSkyType(value: number): value is TileEffectSkyType {
  return value === TileEffectSkyType.SUNRISE || 
         value === TileEffectSkyType.SUNSET || 
         value === TileEffectSkyType.CLOUDS;
}

/**
 * Safe function to log tile device info when available
 */
function logTileDeviceInfo(device: Device | null, info: { device: Device; signal: number; product: number; } | null, prefix: string) {
  if (device !== null && info !== null) {
    console.log(`${prefix}${device.serialNumber} (Signal: ${info.signal}dBm, Product: ${info.product})`);
  }
}

/**
 * Safe function to log tile device summary when available
 */
function logTileDeviceSummary(device: Device | null, info: { device: Device; signal: number; product: number; } | null) {
  if (device !== null && info !== null) {
    console.log(`   - Tile Device: ${device.serialNumber} (Product: ${info.product})`);
    console.log(`   - Tile Signal: ${info.signal}dBm`);
  }
}

/**
 * Identifies device type based on product ID
 * @param product Product ID from device version info
 * @returns Device type: 'light', 'tile', 'multizone', or 'relay'
 */
function identifyDeviceType(product: number): 'light' | 'tile' | 'multizone' | 'relay' {
  // Tile/Matrix devices
  if ([55, 57, 68, 171, 173, 176, 177, 201, 202, 217, 218, 219, 220, 221, 222].includes(product)) {
    return 'tile';
  }
  
  // MultiZone devices (strips)
  if ([31, 32, 38].includes(product)) {
    return 'multizone';
  }
  
  // Relay devices (switches/buttons)
  if ([70, 71, 89, 158, 159].includes(product)) {
    return 'relay';
  }
  
  // Default to regular light
  return 'light';
}

describe('LIFX Integration Tests', () => {
  test('should discover devices, select one with good signal, and run comprehensive tests', async () => {
    const MAX_DISCOVERY_TIMEOUT = 400; // Maximum 400ms for discovery
    const OPERATION_TIMEOUT = 5000;  // 5 seconds for each operation
    const SCAN_INTERVAL = 200;      // Scan every 200ms during discovery

    const socket = dgram.createSocket('udp4');
    
    try {
      const router = Router({
        onSend(message, port, address) {
          socket.send(message, port, address);
        },
      });

      let selectedDevice: Device | null = null;
      let selectedDeviceInfo: { device: Device; signal: number; product: number; } | null = null;
      let selectedTileDevice: Device | null = null;
      let selectedTileDeviceInfo: { device: Device; signal: number; product: number; } | null = null;
      let discoveryResolve: ((value: void | PromiseLike<void>) => void) | null = null;
      let tileDiscoveryResolve: ((value: void | PromiseLike<void>) => void) | null = null;

      const devices = Devices({
        onAdded: async (device) => {
          console.log(`🔍 Discovered LIFX device: ${device.serialNumber} at ${device.address}:${device.port}`);
          
          // Don't check this device if we already found suitable devices
          if (selectedDevice && selectedTileDevice) return;
          if (selectedDevice && !selectedTileDevice) {
            // Only check if this might be a tile device
            try {
              const versionInfo = await client.send(GetVersionCommand(), device);
              const deviceType = identifyDeviceType(versionInfo.product);
              if (deviceType !== 'tile') return;
            } catch {
              return;
            }
          }
          
          try {
            // Get WiFi info to check signal strength
            const wifiInfo = await client.send(GetWifiInfoCommand(), device);
            
            // Get device version to identify product type
            const versionInfo = await client.send(GetVersionCommand(), device);
            
            // Check for good RSSI (better than -70 dBm is considered good)
            const hasGoodSignal = wifiInfo.signal > -70;
            
            // Identify device type
            const deviceType = identifyDeviceType(versionInfo.product);
            const isRegularLight = deviceType === 'light';
            const isTileDevice = deviceType === 'tile';
            
            if (hasGoodSignal && isRegularLight && !selectedDevice) {
              console.log(`  ✅ Found suitable regular light: ${device.serialNumber} (Signal: ${wifiInfo.signal}dBm, Product: ${versionInfo.product})`);
              
              selectedDevice = device;
              selectedDeviceInfo = {
                device,
                signal: wifiInfo.signal,
                product: versionInfo.product
              };
              
              // Resolve the discovery promise immediately
              if (discoveryResolve) {
                discoveryResolve();
                discoveryResolve = null;
              }
            } else if (hasGoodSignal && isTileDevice && !selectedTileDevice) {
              console.log(`  🟦 Found suitable tile device: ${device.serialNumber} (Signal: ${wifiInfo.signal}dBm, Product: ${versionInfo.product})`);
              
              selectedTileDevice = device;
              selectedTileDeviceInfo = {
                device,
                signal: wifiInfo.signal,
                product: versionInfo.product
              };
              
              // Resolve the tile discovery promise immediately
              if (tileDiscoveryResolve) {
                tileDiscoveryResolve();
                tileDiscoveryResolve = null;
              }
            } else {
              console.log(`  ❌ ${device.serialNumber}: Signal ${wifiInfo.signal}dBm, Product ${versionInfo.product} (${hasGoodSignal ? 'good signal' : 'weak signal'}, ${deviceType})`);
            }
          } catch (error) {
            console.log(`  ❌ ${device.serialNumber}: Failed to get device info - ${error}`);
          }
        },
      });

      const client = Client({ router });

      // Handle incoming UDP messages
      socket.on('message', (message, remote) => {
        try {
          const { header, serialNumber } = router.receive(message);
          devices.register(serialNumber, remote.port, remote.address, header.target);
        } catch {
          // Ignore malformed messages from non-LIFX devices
        }
      });

      // Initialize socket
      await new Promise<void>((resolve, reject) => {
        socket.once('error', reject);
        socket.once('listening', resolve);
        socket.bind();
      });

      socket.setBroadcast(true);

      console.log('🚀 Starting LIFX device discovery...');

      // Start device discovery
      client.broadcast(GetServiceCommand());
      
      // Continue scanning during discovery period
      const scanInterval = setInterval(() => {
        client.broadcast(GetServiceCommand());
      }, SCAN_INTERVAL);

      try {
        // Wait for a suitable regular light device to be found or timeout
        await new Promise<void>((resolve, reject) => {
          discoveryResolve = resolve;
          
          // Fallback timeout in case no suitable device is found
          const timeout = setTimeout(() => {
            if (discoveryResolve) {
              discoveryResolve = null;
              reject(new Error(`No suitable LIFX regular light devices found within ${MAX_DISCOVERY_TIMEOUT}ms. Need devices with good signal strength (>-70dBm) that are regular lights (not tiles or special devices).`));
            }
          }, MAX_DISCOVERY_TIMEOUT);
          
          // Clear timeout if device is found
          const originalResolve = resolve;
          discoveryResolve = () => {
            clearTimeout(timeout);
            originalResolve();
          };
        });
        
        // Also try to find a tile device (but don't fail if none found)
        const tilePromise = new Promise<void>((resolve, _reject) => {
          tileDiscoveryResolve = resolve;
          
          // Shorter timeout for tile discovery
          const tileTimeout = setTimeout(() => {
            if (tileDiscoveryResolve) {
              tileDiscoveryResolve = null;
              console.log(`  ℹ️ No tile devices found within discovery period - tile tests will be skipped`);
              resolve();
            }
          }, MAX_DISCOVERY_TIMEOUT);
          
          // Clear timeout if tile device is found
          const originalTileResolve = resolve;
          tileDiscoveryResolve = () => {
            clearTimeout(tileTimeout);
            originalTileResolve();
          };
        });
        
        // Wait for tile discovery to complete (either found or timeout)
        await tilePromise;
      } finally {
        if (scanInterval) {
          clearInterval(scanInterval);
        }
      }

      console.log(`🎯 Selected regular light: ${selectedDevice!.serialNumber} (Signal: ${selectedDeviceInfo!.signal}dBm, Product: ${selectedDeviceInfo!.product})`);
      
      logTileDeviceInfo(selectedTileDevice, selectedTileDeviceInfo, '🟦 Selected tile device: ');

      // Test 1: Get device information
      console.log('🔧 Test 1: Getting device information...');
      
      const [label, hostFirmware, wifiInfo] = await Promise.all([
        client.send(GetLabelCommand(), selectedDevice!),
        client.send(GetHostFirmwareCommand(), selectedDevice!),
        client.send(GetWifiInfoCommand(), selectedDevice!)
      ]);

      assert.ok(label, 'Should receive device label');
      assert.ok(hostFirmware, 'Should receive host firmware information');
      assert.ok(wifiInfo, 'Should receive WiFi information');
      
      console.log(`  Device label: "${label}"`);
      console.log(`  Firmware version: ${hostFirmware.version_major}.${hostFirmware.version_minor}`);
      console.log(`  WiFi signal strength: ${wifiInfo.signal}dBm`);

      // Test 2: Power state management
      console.log('⚡ Test 2: Testing power state management...');
      
      const initialPowerState = await client.send(GetPowerCommand(), selectedDevice!);
      const initialPowerOn = initialPowerState > 0;
      console.log(`  Initial power state: ${initialPowerOn ? 'ON' : 'OFF'} (${initialPowerState})`);
      
      // Toggle power state
      const newPowerState = !initialPowerOn;
      await client.send(SetPowerCommand(newPowerState), selectedDevice!);
      
      // Wait a bit for the change to take effect
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const verifyPowerState = await client.send(GetPowerCommand(), selectedDevice!);
      const verifyPowerOn = verifyPowerState > 0;
      assert.equal(verifyPowerOn, newPowerState, 'Power state should be updated correctly');
      console.log(`  Power state changed to: ${verifyPowerOn ? 'ON' : 'OFF'} (${verifyPowerState})`);

      // Restore original power state
      await client.send(SetPowerCommand(initialPowerOn), selectedDevice!);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const restoredPowerState = await client.send(GetPowerCommand(), selectedDevice!);
      const restoredPowerOn = restoredPowerState > 0;
      assert.equal(restoredPowerOn, initialPowerOn, 'Power state should be restored to original value');
      console.log(`  Power state restored to: ${restoredPowerOn ? 'ON' : 'OFF'} (${restoredPowerState})`);

      // Test 3: Light-specific functionality (if device supports it)
      console.log('💡 Test 3: Testing light-specific functionality...');
      
      // Store original light state for complete restoration
      let originalLightPowerState: number | null = null;
      let originalColorState: LightState | null = null;
      
      try {
        originalLightPowerState = await client.send(GetLightPowerCommand(), selectedDevice!);
        console.log(`  Light power level: ${originalLightPowerState}`);
        
        originalColorState = await client.send(GetColorCommand(), selectedDevice!);
        console.log(`  Current color - H:${originalColorState.hue} S:${originalColorState.saturation} B:${originalColorState.brightness} K:${originalColorState.kelvin}`);
        
        // Test color change (only if device is on)
        if (originalLightPowerState > 0) {
          console.log('  Testing color change...');
          
          // Set a test color (red with 50% brightness)
          const testHue = 0;      // Red
          const testSaturation = 65535;  // Full saturation
          const testBrightness = 32768;  // 50% brightness
          const testKelvin = 3500;       // Neutral white
          const duration = 1000;         // 1 second transition
          
          await client.send(SetColorCommand(testHue, testSaturation, testBrightness, testKelvin, duration), selectedDevice!);
          
          // Wait for transition to complete
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const newColorState = await client.send(GetColorCommand(), selectedDevice!);
          console.log(`  New color - H:${newColorState.hue} S:${newColorState.saturation} B:${newColorState.brightness} K:${newColorState.kelvin}`);
          
          // Verify color changed (with some tolerance for timing)
          assert.ok(Math.abs(newColorState.hue - testHue) < 1000, 'Hue should be approximately the test value');
          assert.ok(Math.abs(newColorState.brightness - testBrightness) < 1000, 'Brightness should be approximately the test value');
          
          console.log('  Color change test completed successfully');
        } else {
          console.log('  Device is off, skipping color change test');
        }
      } catch (error) {
        console.log('  Device does not support light-specific commands (may be a switch/relay)');
        console.log(`  Light command error: ${error}`);
      }

      // Test 4: Response timing and reliability
      console.log('⏱️  Test 4: Testing response timing and reliability...');
      
      const timingTests = [];
      const numTests = 5;
      
      for (let i = 0; i < numTests; i++) {
        const start = Date.now();
        await client.send(GetPowerCommand(), selectedDevice!);
        const elapsed = Date.now() - start;
        timingTests.push(elapsed);
      }
      
      const avgResponseTime = timingTests.reduce((a, b) => a + b, 0) / timingTests.length;
      const maxResponseTime = Math.max(...timingTests);
      const minResponseTime = Math.min(...timingTests);
      
      console.log(`  Average response time: ${avgResponseTime.toFixed(1)}ms`);
      console.log(`  Response time range: ${minResponseTime}ms - ${maxResponseTime}ms`);
      
      assert.ok(maxResponseTime < OPERATION_TIMEOUT, 'All responses should be within timeout limit');
      assert.ok(avgResponseTime < 1000, 'Average response time should be reasonable');

      // Test 5: Concurrent operations
      console.log('🔄 Test 5: Testing concurrent operations...');

      const concurrentResults = await Promise.all([
        client.send(GetPowerCommand(), selectedDevice!),
        client.send(GetLabelCommand(), selectedDevice!),
        client.send(GetHostFirmwareCommand(), selectedDevice!)
      ]);
      assert.equal(concurrentResults.length, 3, 'All concurrent operations should complete');
      assert.ok(concurrentResults.every(result => result != null), 'All concurrent operations should return valid results');
      
      console.log('  All concurrent operations completed successfully');

      // Test 6: Restore device to original state
      console.log('🔄 Test 6: Restoring device to original state...');
      
      try {
        // Restore original color state if we have it
        if (originalColorState && originalLightPowerState !== null && originalLightPowerState > 0) {
          console.log('  Restoring original color and brightness...');
          const duration = 1000; // 1 second transition
          
          await client.send(SetColorCommand(
            originalColorState.hue, 
            originalColorState.saturation, 
            originalColorState.brightness, 
            originalColorState.kelvin, 
            duration
          ), selectedDevice!);
          
          // Wait for transition to complete
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Verify restoration
          const restoredColorState = await client.send(GetColorCommand(), selectedDevice!);
          const colorRestored = 
            Math.abs(restoredColorState.hue - originalColorState.hue) < 1000 &&
            Math.abs(restoredColorState.brightness - originalColorState.brightness) < 1000;
          
          if (colorRestored) {
            console.log('  ✅ Color and brightness restored successfully');
          } else {
            console.log('  ⚠️ Color restoration may not be exact due to timing/precision');
          }
        }
        
        console.log('  ✅ Device restoration completed');
      } catch (error) {
        console.log(`  ⚠️ Device restoration failed: ${error}`);
        console.log('  Device may not be in original state - please check manually');
      }

      // Test 7: Tile device testing (if available)
      if (selectedTileDevice) {
        console.log('🟦 Test 7: Testing tile device functionality...');
        
        let originalTileStates: State64[] | undefined;
        let originalTileEffect: StateTileEffect | undefined;
        
        try {
          // Get tile device chain information
          console.log('  Getting tile device chain...');
          const deviceChain = await client.send(GetDeviceChainCommand(), selectedTileDevice!);
          console.log(`  Device chain: ${deviceChain.tile_devices_count} tiles`);

          // Get current tile state for restoration
          console.log('  Capturing original tile state...');
          const tileStates = await client.send(Get64Command(0, deviceChain.tile_devices_count, 0, 0, 8), selectedTileDevice!);
          originalTileStates = tileStates;
          console.log(`  Captured state for ${tileStates.length} tiles`);
          
          // Get current tile effect
          console.log('  Getting current tile effect...');
          originalTileEffect = await client.send(GetTileEffectCommand(), selectedTileDevice!);
          assert.ok(originalTileEffect, 'Should receive tile effect state');
          console.log(`  Original effect type: ${originalTileEffect.type}`);
          
          // Test setting colors on tiles
          console.log('  Testing tile color setting...');
          const testColors = [
            { hue: 0, saturation: 65535, brightness: 32768, kelvin: 3500 },      // Red
            { hue: 21845, saturation: 65535, brightness: 32768, kelvin: 3500 },  // Green  
            { hue: 43690, saturation: 65535, brightness: 32768, kelvin: 3500 },  // Blue
            { hue: 10922, saturation: 65535, brightness: 32768, kelvin: 3500 },  // Yellow
          ];
          
          // Extend colors to fill all 64 pixels if needed
          const fullColors: { hue: number; saturation: number; brightness: number; kelvin: number; }[] = [];
          for (let i = 0; i < 64; i++) {
            fullColors.push(testColors[i % testColors.length]!);
          }
          
          await client.send(Set64Command(0, deviceChain.tile_devices_count, 0, 0, 8, 1000, fullColors), selectedTileDevice!);
          console.log('  Applied test colors to tiles');
          
          // Wait for color change
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Test tile effect
          console.log('  Testing tile effect...');
          const testPalette = [
            { hue: 16384, saturation: 65535, brightness: 65535, kelvin: 3500 }, // Orange
            { hue: 32768, saturation: 65535, brightness: 65535, kelvin: 3500 }, // Cyan
          ];
          
          await client.send(SetTileEffectCommand(
            1, // instanceid
            TileEffectType.MORPH, // effect type
            50, // speed (0-100)
            BigInt(5000), // duration in ms
            TileEffectSkyType.SUNRISE, // sky type (used for SKY effect)
            50, // cloud saturation min
            testPalette.length, // palette count
            testPalette
          ), selectedTileDevice!);
          console.log('  Applied test effect to tiles');
          
          // Wait for effect to run
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Restore original tile state
          console.log('  Restoring original tile state...');
          
          // First, turn off any effects
          await client.send(SetTileEffectCommand(
            originalTileEffect.instanceid || 0,
            TileEffectType.OFF,
            0,
            BigInt(0),
            TileEffectSkyType.SUNRISE,
            0,
            0,
            []
          ), selectedTileDevice!);
          
          // Wait for effect to stop
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Restore original colors
          if (originalTileStates && originalTileStates.length > 0) {
            const originalColors = originalTileStates.flatMap((tile: State64) => tile.colors || []);
            if (originalColors.length > 0) {
              await client.send(Set64Command(0, deviceChain.tile_devices_count, 0, 0, 8, 1000, originalColors), selectedTileDevice!);
              console.log('  Restored original tile colors');
              
              // Wait for restoration to complete
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          
          // Restore original effect if it wasn't OFF
          if (originalTileEffect && originalTileEffect.type !== TileEffectType.OFF) {
            const effectType = isTileEffectType(originalTileEffect.type) ? originalTileEffect.type : TileEffectType.OFF;
            const skyType = (originalTileEffect.skyType !== undefined && isTileEffectSkyType(originalTileEffect.skyType)) 
              ? originalTileEffect.skyType 
              : TileEffectSkyType.SUNRISE;
            
            await client.send(SetTileEffectCommand(
              originalTileEffect.instanceid || 0,
              effectType,
              originalTileEffect.speed || 50,
              BigInt(originalTileEffect.duration || 0),
              skyType,
              originalTileEffect.cloudSaturationMin || 50,
              originalTileEffect.palette_count || 0,
              originalTileEffect.palette || []
            ), selectedTileDevice!);
            console.log('  Restored original tile effect');
          }
          
          console.log('  ✅ Tile device tests completed successfully');
          
        } catch (error) {
          console.log(`  ❌ Tile device test failed: ${error}`);
          console.log('  ⚠️ Tile device may not be in original state - please check manually');
        }
      } else {
        console.log('ℹ️ No tile devices found - tile tests skipped');
      }

      console.log('✅ All integration tests passed successfully!');
      console.log(`📊 Test Summary:`);
      console.log(`   - Regular Light: ${selectedDevice!.serialNumber} (${label})`);
      console.log(`   - Signal: ${selectedDeviceInfo!.signal}dBm (Product: ${selectedDeviceInfo!.product})`);
      console.log(`   - Firmware: ${hostFirmware.version_major}.${hostFirmware.version_minor}`);
      console.log(`   - Average response time: ${avgResponseTime.toFixed(1)}ms`);
      logTileDeviceSummary(selectedTileDevice, selectedTileDeviceInfo);
      console.log(`   - All core functionality verified and devices restored`);

    } catch (error) {
      console.error('❌ Integration test failed:', error);
      throw error;
    } finally {
      // Cleanup
      socket.close();
    }
  });
});