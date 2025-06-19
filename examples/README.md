# LIFX Scene Management Examples

This directory contains examples demonstrating the powerful scene and animation system for LIFX devices.

## Scene Management Demo

The main demo (`scenes-demo.js`) showcases all the scene system features:

### 🎨 Scene System Features

**Core Scene Management:**
- Create custom scenes with multiple devices
- Scene validation and error checking
- Immutable scene operations (add, remove, update devices)
- Scene cloning and modification

**Preset Color Palettes:**
- `warm` - Cozy warm colors (sunset orange, warm red, golden yellow, soft pink)
- `cool` - Refreshing cool colors (ocean blue, mint green, lavender, cool white)
- `nature` - Earth-inspired colors (forest green, sky blue, earthy brown, sunset purple)
- `vibrant` - Bold, energetic colors (electric blue, hot pink, lime green, bright red)

**Scene Templates:**
- `evening()` - Warm, dim lighting for relaxation
- `morning()` - Bright, cool lighting to start the day
- `focus()` - Clean, neutral lighting for productivity
- `party()` - Vibrant colors for celebration
- `off()` - Turn off all lights

**Advanced Animations:**
- Device color transitions with easing functions
- Breathing/pulsing effects
- Color cycling animations
- Animation sequencing and management

**Persistence & Management:**
- Export scenes to JSON
- Import scenes from JSON
- Scene manager for organizing multiple scenes
- Device resolution for scene restoration

## Running the Demo

```bash
# Make sure you're in the project root
cd /path/to/lifx

# Install dependencies
bun install

# Build the project
bun run build

# Run the scene demo
node examples/scenes-demo.js
```

### Prerequisites

1. **LIFX Devices**: Have one or more LIFX devices on your network
2. **Network**: Ensure your computer and LIFX devices are on the same network
3. **Power**: Make sure your LIFX devices are powered on

### What the Demo Does

1. **Device Discovery** - Finds all LIFX devices on your network
2. **Scene Creation** - Creates custom scenes for different moods
3. **Color Palettes** - Demonstrates preset color combinations
4. **Scene Templates** - Shows built-in scene templates
5. **Transitions** - Smoothly transitions between scenes
6. **Animations** - Demonstrates breathing and color cycling effects
7. **Persistence** - Shows how to save and load scenes
8. **Advanced Operations** - Scene cloning and modification

## Code Examples

### Basic Scene Creation

```javascript
import { createScene, COLOR_PALETTES } from 'lifxlan';

// Create a custom scene
const readingScene = createScene({
  name: 'Cozy Reading',
  description: 'Perfect for evening reading',
  duration: 2000, // 2 second transitions
});

// Add devices with specific states
const populatedScene = readingScene.addDevice(device, {
  power: true,
  hue: 7281,        // Warm orange
  saturation: 32768, // 50% saturation  
  brightness: 26214, // 40% brightness
  kelvin: 2700,     // Warm white
});

// Apply the scene
await populatedScene.apply(client);
```

### Using Color Palettes

```javascript
// Use preset colors
const warmColors = COLOR_PALETTES.warm.colors;
const sunsetColor = warmColors[0]; // Sunset orange

const scene = createScene({ name: 'Sunset Mood' })
  .addDevice(device, {
    power: true,
    hue: sunsetColor.hue,
    saturation: sunsetColor.saturation,
    brightness: sunsetColor.brightness,
    kelvin: sunsetColor.kelvin,
  });
```

### Scene Templates

```javascript
import { SCENE_TEMPLATES } from 'lifxlan';

// Quick scene creation
const eveningScene = SCENE_TEMPLATES.evening(devices);
const morningScene = SCENE_TEMPLATES.morning(devices);
const partyScene = SCENE_TEMPLATES.party(devices);

await eveningScene.apply(client);
```

### Animations

```javascript
import { createBreathingAnimation, createColorCycleAnimation } from 'lifxlan';

// Breathing effect
const breathing = createBreathingAnimation(client, device, baseState, {
  duration: 3000,  // 3 second cycles
  cycles: 5,       // 5 breathing cycles
  minBrightness: 13107, // 20%
  maxBrightness: 52428, // 80%
});

await breathing.start();

// Color cycling
const colorCycle = createColorCycleAnimation(client, device, baseState, {
  duration: 10000, // 10 second full cycle
  hueRange: [0, 65535], // Full spectrum
});

await colorCycle.start();
```

### Scene Management

```javascript
import { createSceneManager } from 'lifxlan';

const manager = createSceneManager();

// Add scenes
manager.addScene(readingScene);
manager.addScene(focusScene);

// Apply by name
await manager.applyScene('Cozy Reading', client);

// Export/Import
const exported = manager.exportScenes();
// ... save to file or database ...

const newManager = createSceneManager();
newManager.importScenes(exported, deviceResolver);
```

## Advanced Usage

### Scene Validation

```javascript
const validation = scene.validate();
if (!validation.valid) {
  console.log('Errors:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.log('Warnings:', validation.warnings);
}
```

### Custom Easing Functions

```javascript
import { createDeviceAnimation, EASING_FUNCTIONS } from 'lifxlan';

const animation = createDeviceAnimation(client, device, fromState, toState, {
  duration: 2000,
  easing: 'ease-in-out', // or custom function
  onFrame: (progress, currentState) => {
    console.log(`Animation ${Math.round(progress * 100)}% complete`);
  },
});
```

### Scene Persistence

```javascript
// Save scenes to file
import { writeFileSync } from 'fs';

const scenes = manager.exportScenes();
writeFileSync('my-scenes.json', JSON.stringify(scenes, null, 2));

// Load scenes from file
import { readFileSync } from 'fs';

const savedScenes = JSON.parse(readFileSync('my-scenes.json', 'utf8'));
manager.importScenes(savedScenes, deviceResolver);
```

## Tips

1. **Device Discovery**: Allow 3-5 seconds for device discovery
2. **Network**: Ensure stable Wi-Fi connection for smooth transitions
3. **Performance**: Use fire-and-forget (`client.unicast()`) for rapid animations
4. **Validation**: Always validate scenes before applying in production
5. **Persistence**: Store device serial numbers for reliable scene restoration

## Error Handling

```javascript
try {
  await scene.apply(client, { duration: 2000 });
} catch (error) {
  console.error('Failed to apply scene:', error.message);
  // Fallback to default lighting
  await SCENE_TEMPLATES.off(devices).apply(client);
}
```

The scene system makes it easy to create sophisticated lighting experiences with minimal code!