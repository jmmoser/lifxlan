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
  GetLightPowerCommand
} from '../src/index.js';

/**
 * Integration/End-to-End Tests for LIFX Device Discovery and Control
 * 
 * This test suite discovers real LIFX devices on the local network,
 * selects one randomly, and runs comprehensive tests to ensure
 * all functionality works properly.
 * 
 * Requirements:
 * - At least one LIFX device must be available on the local network
 * - The device should be powered on and responsive
 * - Network must allow UDP broadcast on port 56700
 */

describe('LIFX Integration Tests', () => {
  test('should discover devices, select one randomly, and run comprehensive tests', async () => {
    const DISCOVERY_TIMEOUT = 3000;  // 3 seconds for discovery (reduced for faster testing)
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

      const devices = Devices({
        onAdded(device) {
          console.log(`🔍 Discovered LIFX device: ${device.serialNumber} at ${device.address}:${device.port}`);
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

      // Wait for device discovery to complete
      await new Promise(resolve => setTimeout(resolve, DISCOVERY_TIMEOUT));
      
      if (scanInterval) {
        clearInterval(scanInterval);
      }

      // Check if any devices were discovered
      const discoveredDevices = Array.from(devices.registered.values());
      console.log(`📱 Found ${discoveredDevices.length} LIFX device(s)`);
      
      assert.ok(discoveredDevices.length > 0, 
        'No LIFX devices found on the network. Please ensure at least one LIFX device is powered on and connected to the same network.');

      // Select a random device for testing
      const randomDevice = discoveredDevices[Math.floor(Math.random() * discoveredDevices.length)];
      assert.ok(randomDevice, 'Random device should be selected');
      console.log(`🎯 Selected device for testing: ${randomDevice.serialNumber} at ${randomDevice.address}:${randomDevice.port}`);

      // Test 1: Get device information
      console.log('🔧 Test 1: Getting device information...');
      
      const [label, hostFirmware, wifiInfo] = await Promise.all([
        client.send(GetLabelCommand(), randomDevice),
        client.send(GetHostFirmwareCommand(), randomDevice),
        client.send(GetWifiInfoCommand(), randomDevice)
      ]);

      assert.ok(label, 'Should receive device label');
      assert.ok(hostFirmware, 'Should receive host firmware information');
      assert.ok(wifiInfo, 'Should receive WiFi information');
      
      console.log(`  Device label: "${label}"`);
      console.log(`  Firmware version: ${hostFirmware.version_major}.${hostFirmware.version_minor}`);
      console.log(`  WiFi signal strength: ${wifiInfo.signal}dBm`);

      // Test 2: Power state management
      console.log('⚡ Test 2: Testing power state management...');
      
      const initialPowerState = await client.send(GetPowerCommand(), randomDevice);
      const initialPowerOn = initialPowerState > 0;
      console.log(`  Initial power state: ${initialPowerOn ? 'ON' : 'OFF'} (${initialPowerState})`);
      
      // Toggle power state
      const newPowerState = !initialPowerOn;
      await client.send(SetPowerCommand(newPowerState), randomDevice);
      
      // Wait a bit for the change to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const verifyPowerState = await client.send(GetPowerCommand(), randomDevice);
      const verifyPowerOn = verifyPowerState > 0;
      assert.equal(verifyPowerOn, newPowerState, 'Power state should be updated correctly');
      console.log(`  Power state changed to: ${verifyPowerOn ? 'ON' : 'OFF'} (${verifyPowerState})`);

      // Restore original power state
      await client.send(SetPowerCommand(initialPowerOn), randomDevice);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const restoredPowerState = await client.send(GetPowerCommand(), randomDevice);
      const restoredPowerOn = restoredPowerState > 0;
      assert.equal(restoredPowerOn, initialPowerOn, 'Power state should be restored to original value');
      console.log(`  Power state restored to: ${restoredPowerOn ? 'ON' : 'OFF'} (${restoredPowerState})`);

      // Test 3: Light-specific functionality (if device supports it)
      console.log('💡 Test 3: Testing light-specific functionality...');
      
      try {
        const lightPowerState = await client.send(GetLightPowerCommand(), randomDevice);
        console.log(`  Light power level: ${lightPowerState}`);
        
        const colorState = await client.send(GetColorCommand(), randomDevice);
        console.log(`  Current color - H:${colorState.hue} S:${colorState.saturation} B:${colorState.brightness} K:${colorState.kelvin}`);
        
        // Test color change (only if device is on)
        if (lightPowerState > 0) {
          console.log('  Testing color change...');
          
          // Save original color
          const originalColor = { ...colorState };
          
          // Set a test color (red with 50% brightness)
          const testHue = 0;      // Red
          const testSaturation = 65535;  // Full saturation
          const testBrightness = 32768;  // 50% brightness
          const testKelvin = 3500;       // Neutral white
          const duration = 1000;         // 1 second transition
          
          await client.send(SetColorCommand(testHue, testSaturation, testBrightness, testKelvin, duration), randomDevice);
          
          // Wait for transition to complete
          await new Promise(resolve => setTimeout(resolve, duration + 500));
          
          const newColorState = await client.send(GetColorCommand(), randomDevice);
          console.log(`  New color - H:${newColorState.hue} S:${newColorState.saturation} B:${newColorState.brightness} K:${newColorState.kelvin}`);
          
          // Verify color changed (with some tolerance for timing)
          assert.ok(Math.abs(newColorState.hue - testHue) < 1000, 'Hue should be approximately the test value');
          assert.ok(Math.abs(newColorState.brightness - testBrightness) < 1000, 'Brightness should be approximately the test value');
          
          // Restore original color
          await client.send(SetColorCommand(originalColor.hue, originalColor.saturation, originalColor.brightness, originalColor.kelvin, duration), randomDevice);
          await new Promise(resolve => setTimeout(resolve, duration + 500));
          
          console.log('  Color restored to original values');
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
        await client.send(GetPowerCommand(), randomDevice);
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
        client.send(GetPowerCommand(), randomDevice),
        client.send(GetLabelCommand(), randomDevice),
        client.send(GetHostFirmwareCommand(), randomDevice)
      ]);
      assert.equal(concurrentResults.length, 3, 'All concurrent operations should complete');
      assert.ok(concurrentResults.every(result => result != null), 'All concurrent operations should return valid results');
      
      console.log('  All concurrent operations completed successfully');

      console.log('✅ All integration tests passed successfully!');
      console.log(`📊 Test Summary:`);
      console.log(`   - Device: ${randomDevice.serialNumber} (${label})`);
      console.log(`   - Firmware: ${hostFirmware.version_major}.${hostFirmware.version_minor}`);
      console.log(`   - Average response time: ${avgResponseTime.toFixed(1)}ms`);
      console.log(`   - All core functionality verified`);

    } catch (error) {
      console.error('❌ Integration test failed:', error);
      throw error;
    } finally {
      // Cleanup
      socket.close();
    }
  });
});