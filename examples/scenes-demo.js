#!/usr/bin/env node

/**
 * LIFX Scene Management Demo
 * 
 * This example demonstrates the new scene and preset system for LIFX devices.
 * It shows how to:
 * - Create and manage scenes
 * - Use preset color palettes
 * - Apply scene templates
 * - Animate between scenes
 * - Save and load scenes
 */

import dgram from 'node:dgram';
import { 
  Client, 
  Router, 
  Devices,
  GetServiceCommand,
  createScene,
  createSceneManager,
  createBreathingAnimation,
  createColorCycleAnimation,
  createAnimationManager,
  COLOR_PALETTES,
  SCENE_TEMPLATES
} from '../src/index.js';

// Configuration
const DISCOVERY_TIME = 3000; // 3 seconds to discover devices
const SCENE_HOLD_TIME = 5000; // 5 seconds per scene

console.log('🎨 LIFX Scene Management Demo');
console.log('=============================\n');

// Set up UDP socket and router
const socket = dgram.createSocket('udp4');

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

// Set up device tracking
const devices = Devices({
  onAdded(device) {
    console.log(`📱 Discovered device: ${device.serialNumber} at ${device.address}`);
  },
});

// Handle incoming messages
socket.on('message', (message, remote) => {
  const { header, serialNumber } = router.receive(message);
  devices.register(serialNumber, remote.port, remote.address, header.target);
});

// Set up client and scene manager
const client = Client({ router });
const sceneManager = createSceneManager();
const animationManager = createAnimationManager();

// Wait for socket to be ready
await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

socket.setBroadcast(true);

console.log('🔍 Discovering LIFX devices on your network...');
console.log('(Make sure your devices are powered on)\n');

// Discover devices
client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => {
  client.broadcast(GetServiceCommand());
}, 1000);

// Wait for device discovery
await new Promise(resolve => setTimeout(resolve, DISCOVERY_TIME));
clearInterval(scanInterval);

const discoveredDevices = Array.from(devices);

if (discoveredDevices.length === 0) {
  console.log('❌ No LIFX devices found on your network.');
  console.log('   Make sure your devices are:');
  console.log('   • Powered on');
  console.log('   • Connected to the same network');
  console.log('   • Not in sleep mode');
  socket.close();
  process.exit(1);
}

console.log(`✅ Found ${discoveredDevices.length} device(s)!\n`);

// Demo 1: Create custom scenes
console.log('📝 Demo 1: Creating Custom Scenes');
console.log('==================================');

// Create a cozy reading scene
const readingScene = createScene({
  name: 'Cozy Reading',
  description: 'Warm, gentle lighting perfect for reading',
  duration: 2000,
});

// Add devices to the scene with warm, dim lighting
let populatedReadingScene = readingScene;
for (const device of discoveredDevices) {
  populatedReadingScene = populatedReadingScene.addDevice(device, {
    power: true,
    hue: 7281,     // Warm orange
    saturation: 32768,  // 50% saturation
    brightness: 26214,  // 40% brightness
    kelvin: 2700,  // Warm white
  });
}

sceneManager.addScene(populatedReadingScene);

// Create a focus work scene
const focusScene = createScene({
  name: 'Focus Work',
  description: 'Bright, cool lighting for productivity',
  duration: 1500,
});

let populatedFocusScene = focusScene;
for (const device of discoveredDevices) {
  populatedFocusScene = populatedFocusScene.addDevice(device, {
    power: true,
    hue: 0,        // No hue (white)
    saturation: 0, // No saturation (pure white)
    brightness: 52428,  // 80% brightness
    kelvin: 5000,  // Cool white
  });
}

sceneManager.addScene(populatedFocusScene);

console.log(`✅ Created ${sceneManager.listScenes().length} custom scenes`);

// Validate scenes
for (const sceneName of sceneManager.listScenes()) {
  const scene = sceneManager.getScene(sceneName);
  const validation = scene.validate();
  if (validation.valid) {
    console.log(`   ✅ "${sceneName}" - Valid`);
  } else {
    console.log(`   ❌ "${sceneName}" - Errors: ${validation.errors.join(', ')}`);
  }
  if (validation.warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${validation.warnings.join(', ')}`);
  }
}

// Demo 2: Use preset color palettes
console.log('\n🎨 Demo 2: Preset Color Palettes');
console.log('=================================');

// Create scenes from color palettes
const paletteNames = Object.keys(COLOR_PALETTES);
console.log(`📦 Available palettes: ${paletteNames.join(', ')}`);

// Create a vibrant party scene using the vibrant palette
const vibrantColors = COLOR_PALETTES.vibrant.colors;
const partyScene = createScene({
  name: 'Vibrant Party',
  description: 'Colorful party atmosphere',
  duration: 1000,
});

let populatedPartyScene = partyScene;
discoveredDevices.forEach((device, index) => {
  const color = vibrantColors[index % vibrantColors.length];
  populatedPartyScene = populatedPartyScene.addDevice(device, {
    power: true,
    hue: color.hue,
    saturation: color.saturation,
    brightness: color.brightness,
    kelvin: color.kelvin,
  });
});

sceneManager.addScene(populatedPartyScene);
console.log('✅ Created "Vibrant Party" scene from color palette');

// Demo 3: Scene templates
console.log('\n📋 Demo 3: Scene Templates');
console.log('==========================');

// Use built-in scene templates
const eveningScene = SCENE_TEMPLATES.evening(discoveredDevices);
const morningScene = SCENE_TEMPLATES.morning(discoveredDevices);
const offScene = SCENE_TEMPLATES.off(discoveredDevices);

sceneManager.addScene(eveningScene);
sceneManager.addScene(morningScene);
sceneManager.addScene(offScene);

console.log('✅ Added scene templates:');
console.log('   • Evening Relax - Warm, dim lighting');
console.log('   • Morning Energy - Bright, cool lighting');
console.log('   • All Off - Turn off all lights');

// Demo 4: Apply scenes with transitions
console.log('\n🎬 Demo 4: Scene Transitions');
console.log('============================');

const demoScenes = [
  'Morning Energy',
  'Focus Work', 
  'Cozy Reading',
  'Vibrant Party',
  'Evening Relax'
];

for (const sceneName of demoScenes) {
  console.log(`🔄 Applying scene: "${sceneName}"`);
  await sceneManager.applyScene(sceneName, client, { duration: 2000 });
  await new Promise(resolve => setTimeout(resolve, SCENE_HOLD_TIME));
}

// Demo 5: Animations
console.log('\n🌈 Demo 5: Animations');
console.log('=====================');

if (discoveredDevices.length > 0) {
  const firstDevice = discoveredDevices[0];
  
  // Breathing animation
  console.log('💨 Starting breathing animation...');
  const breathingAnimation = createBreathingAnimation(
    client,
    firstDevice,
    {
      power: true,
      hue: 43690, // Blue
      saturation: 65535,
      brightness: 45875,
      kelvin: 4000,
    },
    {
      duration: 3000, // 3 second breathing cycle
      cycles: 3,      // 3 breathing cycles
      minBrightness: 13107, // 20% brightness
      maxBrightness: 52428, // 80% brightness
    }
  );
  
  await animationManager.start('breathing', breathingAnimation);
  
  // Color cycling animation
  console.log('🌈 Starting color cycling animation...');
  const colorCycleAnimation = createColorCycleAnimation(
    client,
    firstDevice,
    {
      power: true,
      hue: 0,
      saturation: 65535,
      brightness: 45875,
      kelvin: 3500,
    },
    {
      duration: 5000, // 5 second color cycle
      hueRange: [0, 65535], // Full hue range
    }
  );
  
  await new Promise(resolve => {
    setTimeout(() => {
      colorCycleAnimation.stop();
      resolve();
    }, 10000); // Run for 10 seconds
  });
}

// Demo 6: Scene persistence
console.log('\n💾 Demo 6: Scene Persistence');
console.log('============================');

// Export scenes to JSON
const exportedScenes = sceneManager.exportScenes();
console.log(`📤 Exported ${Object.keys(exportedScenes).length} scenes to JSON`);

// Show a sample of the exported data
const sampleScene = Object.values(exportedScenes)[0];
console.log('\n📄 Sample exported scene structure:');
console.log(JSON.stringify({
  options: sampleScene.options,
  deviceCount: sampleScene.devices.length,
  firstDevice: sampleScene.devices[0] ? {
    serialNumber: sampleScene.devices[0].serialNumber,
    state: sampleScene.devices[0].state
  } : null
}, null, 2));

// Create a new scene manager and import scenes
const newSceneManager = createSceneManager();
const deviceResolver = (serialNumber, address, port) => {
  return discoveredDevices.find(d => d.serialNumber === serialNumber) || 
         { serialNumber, address, port };
};

newSceneManager.importScenes(exportedScenes, deviceResolver);
console.log(`📥 Imported ${newSceneManager.listScenes().length} scenes to new manager`);

// Demo 7: Advanced scene manipulation
console.log('\n⚙️ Demo 7: Advanced Scene Operations');
console.log('====================================');

// Clone and modify a scene
const originalScene = sceneManager.getScene('Evening Relax');
const modifiedScene = originalScene
  .clone({ name: 'Evening Relax - Dimmer', duration: 3000 })
  .updateDevice(discoveredDevices[0], { brightness: 13107 }); // Make first device dimmer

sceneManager.addScene(modifiedScene);
console.log('🔄 Cloned and modified "Evening Relax" scene');

// Apply the modified scene
console.log('🎬 Applying modified scene...');
await sceneManager.applyScene('Evening Relax - Dimmer', client);

// Demo complete - turn off all lights
console.log('\n🏁 Demo Complete');
console.log('================');
console.log('🔄 Turning off all lights...');
await sceneManager.applyScene('All Off', client);

console.log('\n✨ Scene management demo completed successfully!');
console.log('\nWhat you\'ve seen:');
console.log('• Custom scene creation with validation');
console.log('• Preset color palettes and templates');
console.log('• Smooth scene transitions');
console.log('• Breathing and color cycling animations');
console.log('• Scene persistence (export/import)');
console.log('• Advanced scene operations (clone, modify)');
console.log('\n🎨 Your LIFX devices are now ready for amazing lighting experiences!');

socket.close();