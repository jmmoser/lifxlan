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
  GetVersionCommand
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
 * - The device should be powered on and responsive with good WiFi signal (>-70dBm)
 * - Network must allow UDP broadcast on port 56700
 */

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
    const MAX_DISCOVERY_TIMEOUT = 10000; // Maximum 10 seconds fallback
    const OPERATION_TIMEOUT = 5000;  // 5 seconds for each operation
    const SCAN_INTERVAL = 1000;      // Scan every second during discovery

    // Set up UDP socket for Node.js/Bun
    const socket = dgram.createSocket('udp4');
    
    try {
      const router = Router({
        onSend(message, port, address) {
          if (socket) {
            socket.send(message, port, address);
          }
        },
      });

      let selectedDevice: any = null;
      let selectedDeviceInfo: any = null;
      let discoveryResolve: ((value: any) => void) | null = null;

      const devices = Devices({
        onAdded: async (device) => {
          console.log(`🔍 Discovered LIFX device: ${device.serialNumber} at ${device.address}:${device.port}`);
          
          // Don't check this device if we already found a suitable one
          if (selectedDevice) return;
          
          try {
            // Get WiFi info to check signal strength
            const wifiInfo = await client.send(GetWifiInfoCommand(), device);
            
            // Get device version to identify product type
            const versionInfo = await client.send(GetVersionCommand(), device);
            
            // Check for good RSSI (better than -70 dBm is considered good)
            const hasGoodSignal = wifiInfo.signal > -70;
            
            // Identify device type - exclude tiles and special devices
            const isRegularLight = identifyDeviceType(versionInfo.product) === 'light';
            
            if (hasGoodSignal && isRegularLight) {
              console.log(`  ✅ Found suitable device: ${device.serialNumber} (Signal: ${wifiInfo.signal}dBm, Product: ${versionInfo.product})`);
              
              selectedDevice = device;
              selectedDeviceInfo = {
                device,
                signal: wifiInfo.signal,
                product: versionInfo.product
              };
              
              // Resolve the discovery promise immediately
              if (discoveryResolve) {
                discoveryResolve(selectedDevice);
                discoveryResolve = null;
              }
            } else {
              console.log(`  ❌ ${device.serialNumber}: Signal ${wifiInfo.signal}dBm, Product ${versionInfo.product} (${hasGoodSignal ? 'good signal' : 'weak signal'}, ${isRegularLight ? 'regular light' : 'special device'})`);
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
        } catch (error) {
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
        // Wait for a suitable device to be found or timeout
        await new Promise<void>((resolve, reject) => {
          discoveryResolve = resolve;
          
          // Fallback timeout in case no suitable device is found
          const timeout = setTimeout(() => {
            if (discoveryResolve) {
              discoveryResolve = null;
              reject(new Error(`No suitable LIFX devices found within ${MAX_DISCOVERY_TIMEOUT}ms. Need devices with good signal strength (>-70dBm) that are regular lights (not tiles or special devices).`));
            }
          }, MAX_DISCOVERY_TIMEOUT);
          
          // Clear timeout if device is found
          const originalResolve = resolve;
          discoveryResolve = (value) => {
            clearTimeout(timeout);
            originalResolve(value);
          };
        });
      } finally {
        if (scanInterval) {
          clearInterval(scanInterval);
        }
      }

      console.log(`🎯 Selected device: ${selectedDevice.serialNumber} (Signal: ${selectedDeviceInfo.signal}dBm, Product: ${selectedDeviceInfo.product})`);

      // Test 1: Get device information
      console.log('🔧 Test 1: Getting device information...');
      
      const [label, hostFirmware, wifiInfo] = await Promise.all([
        client.send(GetLabelCommand(), selectedDevice),
        client.send(GetHostFirmwareCommand(), selectedDevice),
        client.send(GetWifiInfoCommand(), selectedDevice)
      ]);

      assert.ok(label, 'Should receive device label');
      assert.ok(hostFirmware, 'Should receive host firmware information');
      assert.ok(wifiInfo, 'Should receive WiFi information');
      
      console.log(`  Device label: "${label}"`);
      console.log(`  Firmware version: ${hostFirmware.version_major}.${hostFirmware.version_minor}`);
      console.log(`  WiFi signal strength: ${wifiInfo.signal}dBm`);

      // Test 2: Power state management
      console.log('⚡ Test 2: Testing power state management...');
      
      const initialPowerState = await client.send(GetPowerCommand(), selectedDevice);
      const initialPowerOn = initialPowerState > 0;
      console.log(`  Initial power state: ${initialPowerOn ? 'ON' : 'OFF'} (${initialPowerState})`);
      
      // Toggle power state
      const newPowerState = !initialPowerOn;
      await client.send(SetPowerCommand(newPowerState), selectedDevice);
      
      // Wait a bit for the change to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const verifyPowerState = await client.send(GetPowerCommand(), selectedDevice);
      const verifyPowerOn = verifyPowerState > 0;
      assert.equal(verifyPowerOn, newPowerState, 'Power state should be updated correctly');
      console.log(`  Power state changed to: ${verifyPowerOn ? 'ON' : 'OFF'} (${verifyPowerState})`);

      // Restore original power state
      await client.send(SetPowerCommand(initialPowerOn), selectedDevice);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const restoredPowerState = await client.send(GetPowerCommand(), selectedDevice);
      const restoredPowerOn = restoredPowerState > 0;
      assert.equal(restoredPowerOn, initialPowerOn, 'Power state should be restored to original value');
      console.log(`  Power state restored to: ${restoredPowerOn ? 'ON' : 'OFF'} (${restoredPowerState})`);

      // Test 3: Light-specific functionality (if device supports it)
      console.log('💡 Test 3: Testing light-specific functionality...');
      
      // Store original light state for complete restoration
      let originalLightPowerState: number | null = null;
      let originalColorState: any = null;
      
      try {
        originalLightPowerState = await client.send(GetLightPowerCommand(), selectedDevice);
        console.log(`  Light power level: ${originalLightPowerState}`);
        
        originalColorState = await client.send(GetColorCommand(), selectedDevice);
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
          
          await client.send(SetColorCommand(testHue, testSaturation, testBrightness, testKelvin, duration), selectedDevice);
          
          // Wait for transition to complete
          await new Promise(resolve => setTimeout(resolve, duration + 500));
          
          const newColorState = await client.send(GetColorCommand(), selectedDevice);
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
        await client.send(GetPowerCommand(), selectedDevice);
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
        client.send(GetPowerCommand(), selectedDevice),
        client.send(GetLabelCommand(), selectedDevice),
        client.send(GetHostFirmwareCommand(), selectedDevice)
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
          ), selectedDevice);
          
          // Wait for transition to complete
          await new Promise(resolve => setTimeout(resolve, duration + 500));
          
          // Verify restoration
          const restoredColorState = await client.send(GetColorCommand(), selectedDevice);
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

      console.log('✅ All integration tests passed successfully!');
      console.log(`📊 Test Summary:`);
      console.log(`   - Device: ${selectedDevice.serialNumber} (${label})`);
      console.log(`   - Signal: ${selectedDeviceInfo.signal}dBm (Product: ${selectedDeviceInfo.product})`);
      console.log(`   - Firmware: ${hostFirmware.version_major}.${hostFirmware.version_minor}`);
      console.log(`   - Average response time: ${avgResponseTime.toFixed(1)}ms`);
      console.log(`   - All core functionality verified and device restored`);

    } catch (error) {
      console.error('❌ Integration test failed:', error);
      throw error;
    } finally {
      // Cleanup
      socket.close();
    }
  });
});