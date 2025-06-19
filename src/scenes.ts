import type { Device } from './devices.js';
import type { ClientInstance } from './client.js';
import { SetColorCommand, SetPowerCommand } from './commands/index.js';

export interface DeviceState {
  /** Device power state */
  power: boolean;
  /** Hue [0-65535] */
  hue: number;
  /** Saturation [0-65535] */
  saturation: number;
  /** Brightness [0-65535] */
  brightness: number;
  /** Color temperature in Kelvin [1500-9000] */
  kelvin: number;
  /** Device label/name (optional) */
  label?: string | undefined;
}

export interface SceneDevice {
  /** Device instance */
  device: Device;
  /** Target state for this device */
  state: DeviceState;
}

export interface SceneOptions {
  /** Scene name */
  name: string;
  /** Scene description */
  description?: string;
  /** Default transition duration in milliseconds */
  duration?: number;
  /** Scene metadata */
  metadata?: Record<string, unknown>;
}

export interface SceneTransitionOptions {
  /** Transition duration in milliseconds */
  duration?: number;
  /** Transition easing function */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  /** Delay before starting transition in milliseconds */
  delay?: number;
}

export interface Scene {
  /** Scene configuration */
  readonly options: SceneOptions;
  /** Devices and their target states */
  readonly devices: ReadonlyArray<SceneDevice>;
  
  /** Add a device with its target state */
  addDevice(device: Device, state: DeviceState): Scene;
  
  /** Remove a device from the scene */
  removeDevice(device: Device): Scene;
  
  /** Update a device's state in the scene */
  updateDevice(device: Device, state: Partial<DeviceState>): Scene;
  
  /** Get a device's state in the scene */
  getDeviceState(device: Device): DeviceState | undefined;
  
  /** Apply this scene to all devices */
  apply(client: ClientInstance, options?: SceneTransitionOptions): Promise<void>;
  
  /** Validate the scene configuration */
  validate(): SceneValidationResult;
  
  /** Create a copy of this scene with modifications */
  clone(options?: Partial<SceneOptions>): Scene;
  
  /** Serialize scene to JSON */
  toJSON(): SceneJSON;
}

export interface SceneJSON {
  options: SceneOptions;
  devices: Array<{
    serialNumber: string;
    address: string;
    port: number;
    state: DeviceState;
  }>;
}

export interface SceneValidationResult {
  /** Whether the scene is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

export interface DeviceStateValidationResult {
  /** Whether the device state is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Creates a new scene
 */
export function createScene(options: SceneOptions, initialDevices: SceneDevice[] = []): Scene {
  const devices = [...initialDevices];
  
  const scene: Scene = {
    options: { duration: 1000, ...options },
    get devices() { return devices; },
    
    addDevice(device: Device, state: DeviceState): Scene {
      const newDevices = [...devices];
      const existingIndex = newDevices.findIndex(d => d.device.serialNumber === device.serialNumber);
      
      if (existingIndex >= 0) {
        newDevices[existingIndex] = { device, state };
      } else {
        newDevices.push({ device, state });
      }
      
      return createScene(this.options, newDevices);
    },
    
    removeDevice(device: Device): Scene {
      const newDevices = devices.filter(d => d.device.serialNumber !== device.serialNumber);
      return createScene(this.options, newDevices);
    },
    
    updateDevice(device: Device, stateUpdate: Partial<DeviceState>): Scene {
      const newDevices = devices.map(d => {
        if (d.device.serialNumber === device.serialNumber) {
          return { device, state: { ...d.state, ...stateUpdate } };
        }
        return d;
      });
      return createScene(this.options, newDevices);
    },
    
    getDeviceState(device: Device): DeviceState | undefined {
      return devices.find(d => d.device.serialNumber === device.serialNumber)?.state;
    },
    
    async apply(client: ClientInstance, transitionOptions?: SceneTransitionOptions): Promise<void> {
      const duration = transitionOptions?.duration ?? this.options.duration ?? 1000;
      const delay = transitionOptions?.delay ?? 0;
      
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const promises = devices.map(async ({ device, state }) => {
        const commands = [];
        
        // Set power state
        commands.push(client.send(SetPowerCommand(state.power), device));
        
        // Set color if device is powered on
        if (state.power) {
          commands.push(client.send(
            SetColorCommand(state.hue, state.saturation, state.brightness, state.kelvin, duration),
            device
          ));
        }
        
        await Promise.all(commands);
      });
      
      await Promise.all(promises);
    },
    
    clone(optionUpdates?: Partial<SceneOptions>): Scene {
      const newOptions = { ...this.options, ...optionUpdates };
      return createScene(newOptions, [...devices]);
    },
    
    validate(): SceneValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Validate scene options
      if (!this.options.name || this.options.name.trim().length === 0) {
        errors.push('Scene name is required');
      }
      
      if (this.options.duration !== undefined && this.options.duration < 0) {
        errors.push('Scene duration must be non-negative');
      }
      
      if (this.options.duration !== undefined && this.options.duration > 60000) {
        warnings.push('Scene duration is very long (>60s), consider using shorter transitions');
      }
      
      // Validate devices
      if (devices.length === 0) {
        warnings.push('Scene contains no devices');
      }
      
      const serialNumbers = new Set<string>();
      for (const { device, state } of devices) {
        // Check for duplicate devices
        if (serialNumbers.has(device.serialNumber)) {
          errors.push(`Duplicate device with serial number: ${device.serialNumber}`);
        }
        serialNumbers.add(device.serialNumber);
        
        // Validate device state
        const stateValidation = validateDeviceState(state);
        errors.push(...stateValidation.errors.map(e => `Device ${device.serialNumber}: ${e}`));
        warnings.push(...stateValidation.warnings.map(w => `Device ${device.serialNumber}: ${w}`));
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },
    
    toJSON(): SceneJSON {
      return {
        options: this.options,
        devices: devices.map(({ device, state }) => ({
          serialNumber: device.serialNumber,
          address: device.address,
          port: device.port,
          state,
        })),
      };
    },
  };
  
  return scene;
}

/**
 * Validate a device state configuration
 */
export function validateDeviceState(state: DeviceState): DeviceStateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate hue range
  if (state.hue < 0 || state.hue > 65535) {
    errors.push(`Hue must be between 0 and 65535, got ${state.hue}`);
  }
  
  // Validate saturation range
  if (state.saturation < 0 || state.saturation > 65535) {
    errors.push(`Saturation must be between 0 and 65535, got ${state.saturation}`);
  }
  
  // Validate brightness range
  if (state.brightness < 0 || state.brightness > 65535) {
    errors.push(`Brightness must be between 0 and 65535, got ${state.brightness}`);
  }
  
  // Validate kelvin range
  if (state.kelvin < 1500 || state.kelvin > 9000) {
    errors.push(`Kelvin must be between 1500 and 9000, got ${state.kelvin}`);
  }
  
  // Warnings for potentially problematic values
  if (state.power && state.brightness === 0) {
    warnings.push('Device is powered on but brightness is 0');
  }
  
  if (!state.power && state.brightness > 0) {
    warnings.push('Device is powered off but brightness is set');
  }
  
  if (state.saturation === 0 && state.kelvin < 2500) {
    warnings.push('White light with very warm temperature may appear dim');
  }
  
  if (state.brightness > 52428 && state.kelvin > 6500) {
    warnings.push('Very bright cool light may be harsh');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}


/**
 * Restore a scene from JSON
 */
export function sceneFromJSON(json: SceneJSON, deviceResolver: (serialNumber: string, address: string, port: number) => Device): Scene {
  const sceneDevices: SceneDevice[] = [];
  
  for (const deviceData of json.devices) {
    const device = deviceResolver(deviceData.serialNumber, deviceData.address, deviceData.port);
    sceneDevices.push({ device, state: deviceData.state });
  }
  
  return createScene(json.options, sceneDevices);
}

// Color Palette Types and Presets
export interface ColorPalette {
  name: string;
  description?: string;
  colors: Array<{
    name: string;
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
  }>;
}

/**
 * Predefined color palettes
 */
export const COLOR_PALETTES: Record<string, ColorPalette> = {
  warm: {
    name: 'Warm',
    description: 'Cozy warm colors',
    colors: [
      { name: 'Sunset Orange', hue: 7281, saturation: 65535, brightness: 45875, kelvin: 2700 },
      { name: 'Warm Red', hue: 0, saturation: 45875, brightness: 52428, kelvin: 2500 },
      { name: 'Golden Yellow', hue: 10922, saturation: 52428, brightness: 58982, kelvin: 2800 },
      { name: 'Soft Pink', hue: 54613, saturation: 26214, brightness: 52428, kelvin: 3000 },
    ],
  },
  cool: {
    name: 'Cool',
    description: 'Refreshing cool colors',
    colors: [
      { name: 'Ocean Blue', hue: 43690, saturation: 65535, brightness: 45875, kelvin: 4000 },
      { name: 'Mint Green', hue: 21845, saturation: 32768, brightness: 58982, kelvin: 4500 },
      { name: 'Lavender', hue: 49151, saturation: 32768, brightness: 52428, kelvin: 4200 },
      { name: 'Cool White', hue: 0, saturation: 0, brightness: 58982, kelvin: 5000 },
    ],
  },
  nature: {
    name: 'Nature',
    description: 'Earth-inspired natural colors',
    colors: [
      { name: 'Forest Green', hue: 21845, saturation: 58982, brightness: 39321, kelvin: 3500 },
      { name: 'Sky Blue', hue: 43690, saturation: 45875, brightness: 58982, kelvin: 5500 },
      { name: 'Earthy Brown', hue: 5461, saturation: 45875, brightness: 32768, kelvin: 2700 },
      { name: 'Sunset Purple', hue: 49151, saturation: 52428, brightness: 39321, kelvin: 3200 },
    ],
  },
  vibrant: {
    name: 'Vibrant',
    description: 'Bold, energetic colors',
    colors: [
      { name: 'Electric Blue', hue: 43690, saturation: 65535, brightness: 65535, kelvin: 4000 },
      { name: 'Hot Pink', hue: 54613, saturation: 65535, brightness: 58982, kelvin: 3500 },
      { name: 'Lime Green', hue: 21845, saturation: 65535, brightness: 65535, kelvin: 4500 },
      { name: 'Bright Red', hue: 0, saturation: 65535, brightness: 58982, kelvin: 3000 },
    ],
  },
};

/**
 * Scene templates for common scenarios
 */
export const SCENE_TEMPLATES = {
  /**
   * Create a relaxing evening scene
   */
  evening: (devices: Device[]): Scene => {
    const scene = createScene({
      name: 'Evening Relax',
      description: 'Warm, dim lighting for relaxation',
      duration: 2000,
    });
    
    return devices.reduce((s, device) => s.addDevice(device, {
      power: true,
      hue: 7281, // Warm orange
      saturation: 45875,
      brightness: 26214, // 40% brightness
      kelvin: 2700,
    }), scene);
  },
  
  /**
   * Create an energizing morning scene
   */
  morning: (devices: Device[]): Scene => {
    const scene = createScene({
      name: 'Morning Energy',
      description: 'Bright, cool lighting to start the day',
      duration: 1500,
    });
    
    return devices.reduce((s, device) => s.addDevice(device, {
      power: true,
      hue: 0,
      saturation: 0, // White light
      brightness: 58982, // 90% brightness
      kelvin: 5000, // Cool white
    }), scene);
  },
  
  /**
   * Create a focus/work scene
   */
  focus: (devices: Device[]): Scene => {
    const scene = createScene({
      name: 'Focus Mode',
      description: 'Clean, bright lighting for productivity',
      duration: 1000,
    });
    
    return devices.reduce((s, device) => s.addDevice(device, {
      power: true,
      hue: 0,
      saturation: 0,
      brightness: 52428, // 80% brightness
      kelvin: 4500, // Neutral white
    }), scene);
  },
  
  /**
   * Create a party scene with vibrant colors
   */
  party: (devices: Device[]): Scene => {
    const scene = createScene({
      name: 'Party Time',
      description: 'Vibrant colors for celebration',
      duration: 500,
    });
    
    const colors = COLOR_PALETTES.vibrant!.colors;
    return devices.reduce((s, device, index) => {
      const color = colors[index % colors.length]!;
      return s.addDevice(device, {
        power: true,
        hue: color.hue,
        saturation: color.saturation,
        brightness: color.brightness,
        kelvin: color.kelvin,
      });
    }, scene);
  },
  
  /**
   * Turn off all devices
   */
  off: (devices: Device[]): Scene => {
    const scene = createScene({
      name: 'All Off',
      description: 'Turn off all lights',
      duration: 1000,
    });
    
    return devices.reduce((s, device) => s.addDevice(device, {
      power: false,
      hue: 0,
      saturation: 0,
      brightness: 0,
      kelvin: 3500,
    }), scene);
  },
};

/**
 * Scene manager for handling multiple scenes
 */
export interface SceneManager {
  /** Add a scene to the manager */
  addScene(scene: Scene): void;
  
  /** Remove a scene by name */
  removeScene(name: string): void;
  
  /** Get a scene by name */
  getScene(name: string): Scene | undefined;
  
  /** List all scene names */
  listScenes(): string[];
  
  /** Apply a scene by name */
  applyScene(name: string, client: ClientInstance, options?: SceneTransitionOptions): Promise<void>;
  
  /** Save all scenes to JSON */
  exportScenes(): Record<string, SceneJSON>;
  
  /** Load scenes from JSON */
  importScenes(data: Record<string, SceneJSON>, deviceResolver: (serialNumber: string, address: string, port: number) => Device): void;
}

/**
 * Create a scene manager
 */
export function createSceneManager(): SceneManager {
  const scenes = new Map<string, Scene>();
  
  return {
    addScene(scene: Scene): void {
      scenes.set(scene.options.name, scene);
    },
    
    removeScene(name: string): void {
      scenes.delete(name);
    },
    
    getScene(name: string): Scene | undefined {
      return scenes.get(name);
    },
    
    listScenes(): string[] {
      return Array.from(scenes.keys());
    },
    
    async applyScene(name: string, client: ClientInstance, options?: SceneTransitionOptions): Promise<void> {
      const scene = scenes.get(name);
      if (!scene) {
        throw new Error(`Scene "${name}" not found`);
      }
      await scene.apply(client, options);
    },
    
    exportScenes(): Record<string, SceneJSON> {
      const result: Record<string, SceneJSON> = {};
      for (const [name, scene] of scenes) {
        result[name] = scene.toJSON();
      }
      return result;
    },
    
    importScenes(data: Record<string, SceneJSON>, deviceResolver: (serialNumber: string, address: string, port: number) => Device): void {
      for (const [name, sceneData] of Object.entries(data)) {
        const scene = sceneFromJSON(sceneData, deviceResolver);
        scenes.set(name, scene);
      }
    },
  };
}