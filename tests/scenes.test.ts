import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { 
  createScene, 
  createSceneManager, 
  COLOR_PALETTES, 
  SCENE_TEMPLATES,
  validateDeviceState,
  sceneFromJSON,
  type DeviceState
} from '../src/scenes.js';
import { Device } from '../src/devices.js';
import { Client } from '../src/client.js';
import { Router } from '../src/router.js';

// Mock client for testing
const createMockClient = () => {
  const router = Router({ onSend: jest.fn() });
  return Client({ router });
};

// Mock device for testing
const createMockDevice = (serialNumber: string = 'd073d5000001', address: string = '192.168.1.100') => 
  Device({ serialNumber, address, port: 56700 });

describe('Scene System', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mockDevice: ReturnType<typeof createMockDevice>;
  let validDeviceState: DeviceState;

  beforeEach(() => {
    mockClient = createMockClient();
    mockDevice = createMockDevice();
    validDeviceState = {
      power: true,
      hue: 21845, // Green
      saturation: 65535,
      brightness: 45875,
      kelvin: 3500,
    };
  });

  describe('Scene Creation and Management', () => {
    it('should create an empty scene', () => {
      const scene = createScene({
        name: 'Test Scene',
        description: 'A test scene',
        duration: 2000,
      });

      expect(scene.options.name).toBe('Test Scene');
      expect(scene.options.description).toBe('A test scene');
      expect(scene.options.duration).toBe(2000);
      expect(scene.devices).toHaveLength(0);
    });

    it('should add devices to a scene', () => {
      const scene = createScene({ name: 'Test Scene' })
        .addDevice(mockDevice, validDeviceState);

      expect(scene.devices).toHaveLength(1);
      expect(scene.devices[0]!.device.serialNumber).toBe(mockDevice.serialNumber);
      expect(scene.devices[0]!.state).toEqual(validDeviceState);
    });

    it('should update device state in a scene', () => {
      const scene = createScene({ name: 'Test Scene' })
        .addDevice(mockDevice, validDeviceState)
        .updateDevice(mockDevice, { brightness: 32768 });

      const deviceState = scene.getDeviceState(mockDevice);
      expect(deviceState!.brightness).toBe(32768);
      expect(deviceState!.hue).toBe(validDeviceState.hue); // Should preserve other properties
    });

    it('should remove devices from a scene', () => {
      const scene = createScene({ name: 'Test Scene' })
        .addDevice(mockDevice, validDeviceState)
        .removeDevice(mockDevice);

      expect(scene.devices).toHaveLength(0);
    });

    it('should clone scenes with modifications', () => {
      const originalScene = createScene({ name: 'Original', duration: 1000 })
        .addDevice(mockDevice, validDeviceState);

      const clonedScene = originalScene.clone({ name: 'Cloned', duration: 2000 });

      expect(clonedScene.options.name).toBe('Cloned');
      expect(clonedScene.options.duration).toBe(2000);
      expect(clonedScene.devices).toHaveLength(1);
      expect(originalScene.options.name).toBe('Original'); // Original unchanged
    });
  });

  describe('Scene Validation', () => {
    it('should validate valid scenes', () => {
      const scene = createScene({ name: 'Valid Scene', duration: 1000 })
        .addDevice(mockDevice, validDeviceState);

      const validation = scene.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing scene name', () => {
      const scene = createScene({ name: '' });
      const validation = scene.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Scene name is required');
    });

    it('should detect negative duration', () => {
      const scene = createScene({ name: 'Test', duration: -1000 });
      const validation = scene.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Scene duration must be non-negative');
    });

    it('should warn about very long duration', () => {
      const scene = createScene({ name: 'Test', duration: 70000 });
      const validation = scene.validate();

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Scene duration is very long (>60s), consider using shorter transitions');
    });

    it('should detect duplicate devices', () => {
      const scene = createScene({ name: 'Test' })
        .addDevice(mockDevice, validDeviceState)
        .addDevice(mockDevice, { ...validDeviceState, brightness: 32768 });

      // Scene should only have one device (second add should update)
      expect(scene.devices).toHaveLength(1);
      expect(scene.devices[0]!.state.brightness).toBe(32768);
    });

    it('should warn about empty scenes', () => {
      const scene = createScene({ name: 'Empty Scene' });
      const validation = scene.validate();

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Scene contains no devices');
    });
  });

  describe('Device State Validation', () => {
    it('should validate valid device states', () => {
      const validation = validateDeviceState(validDeviceState);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid hue values', () => {
      const invalidState = { ...validDeviceState, hue: -1 };
      const validation = validateDeviceState(invalidState);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Hue must be between 0 and 65535, got -1');
    });

    it('should detect invalid saturation values', () => {
      const invalidState = { ...validDeviceState, saturation: 70000 };
      const validation = validateDeviceState(invalidState);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Saturation must be between 0 and 65535, got 70000');
    });

    it('should detect invalid brightness values', () => {
      const invalidState = { ...validDeviceState, brightness: -100 };
      const validation = validateDeviceState(invalidState);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Brightness must be between 0 and 65535, got -100');
    });

    it('should detect invalid kelvin values', () => {
      const invalidState = { ...validDeviceState, kelvin: 10000 };
      const validation = validateDeviceState(invalidState);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Kelvin must be between 1500 and 9000, got 10000');
    });

    it('should warn about powered on device with zero brightness', () => {
      const state = { ...validDeviceState, power: true, brightness: 0 };
      const validation = validateDeviceState(state);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Device is powered on but brightness is 0');
    });

    it('should warn about powered off device with brightness', () => {
      const state = { ...validDeviceState, power: false, brightness: 30000 };
      const validation = validateDeviceState(state);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Device is powered off but brightness is set');
    });
  });

  describe('Scene Serialization', () => {
    it('should serialize scenes to JSON', () => {
      const scene = createScene({ name: 'Test Scene', description: 'Test', duration: 1500 })
        .addDevice(mockDevice, validDeviceState);

      const json = scene.toJSON();

      expect(json.options.name).toBe('Test Scene');
      expect(json.options.description).toBe('Test');
      expect(json.options.duration).toBe(1500);
      expect(json.devices).toHaveLength(1);
      expect(json.devices[0]!.serialNumber).toBe(mockDevice.serialNumber);
      expect(json.devices[0]!.state).toEqual(validDeviceState);
    });

    it('should restore scenes from JSON', () => {
      const originalScene = createScene({ name: 'Original', duration: 2000 })
        .addDevice(mockDevice, validDeviceState);

      const json = originalScene.toJSON();
      
      const deviceResolver = (serialNumber: string, address: string, port: number) => 
        Device({ serialNumber, address, port });

      const restoredScene = sceneFromJSON(json, deviceResolver);

      expect(restoredScene.options.name).toBe('Original');
      expect(restoredScene.options.duration).toBe(2000);
      expect(restoredScene.devices).toHaveLength(1);
      expect(restoredScene.devices[0]!.device.serialNumber).toBe(mockDevice.serialNumber);
      expect(restoredScene.devices[0]!.state).toEqual(validDeviceState);
    });
  });

  describe('Color Palettes', () => {
    it('should have predefined color palettes', () => {
      expect(COLOR_PALETTES.warm).toBeDefined();
      expect(COLOR_PALETTES.cool).toBeDefined();
      expect(COLOR_PALETTES.nature).toBeDefined();
      expect(COLOR_PALETTES.vibrant).toBeDefined();

      expect(COLOR_PALETTES.warm!.colors).toHaveLength(4);
      expect(COLOR_PALETTES.warm!.colors[0]).toHaveProperty('name');
      expect(COLOR_PALETTES.warm!.colors[0]).toHaveProperty('hue');
      expect(COLOR_PALETTES.warm!.colors[0]).toHaveProperty('saturation');
      expect(COLOR_PALETTES.warm!.colors[0]).toHaveProperty('brightness');
      expect(COLOR_PALETTES.warm!.colors[0]).toHaveProperty('kelvin');
    });

    it('should have valid color values in palettes', () => {
      for (const palette of Object.values(COLOR_PALETTES)) {
        for (const color of palette.colors) {
          expect(color.hue).toBeGreaterThanOrEqual(0);
          expect(color.hue).toBeLessThanOrEqual(65535);
          expect(color.saturation).toBeGreaterThanOrEqual(0);
          expect(color.saturation).toBeLessThanOrEqual(65535);
          expect(color.brightness).toBeGreaterThanOrEqual(0);
          expect(color.brightness).toBeLessThanOrEqual(65535);
          expect(color.kelvin).toBeGreaterThanOrEqual(1500);
          expect(color.kelvin).toBeLessThanOrEqual(9000);
        }
      }
    });
  });

  describe('Scene Templates', () => {
    it('should create evening scene template', () => {
      const devices = [mockDevice];
      const scene = SCENE_TEMPLATES.evening(devices);

      expect(scene.options.name).toBe('Evening Relax');
      expect(scene.devices).toHaveLength(1);
      expect(scene.devices[0]!.state.power).toBe(true);
      expect(scene.devices[0]!.state.kelvin).toBe(2700); // Warm light
    });

    it('should create morning scene template', () => {
      const devices = [mockDevice];
      const scene = SCENE_TEMPLATES.morning(devices);

      expect(scene.options.name).toBe('Morning Energy');
      expect(scene.devices).toHaveLength(1);
      expect(scene.devices[0]!.state.power).toBe(true);
      expect(scene.devices[0]!.state.saturation).toBe(0); // White light
      expect(scene.devices[0]!.state.kelvin).toBe(5000); // Cool white
    });

    it('should create focus scene template', () => {
      const devices = [mockDevice];
      const scene = SCENE_TEMPLATES.focus(devices);

      expect(scene.options.name).toBe('Focus Mode');
      expect(scene.devices).toHaveLength(1);
      expect(scene.devices[0]!.state.power).toBe(true);
      expect(scene.devices[0]!.state.kelvin).toBe(4500); // Neutral white
    });

    it('should create party scene template', () => {
      const devices = [mockDevice, createMockDevice('d073d5000002')];
      const scene = SCENE_TEMPLATES.party(devices);

      expect(scene.options.name).toBe('Party Time');
      expect(scene.devices).toHaveLength(2);
      expect(scene.devices[0]!.state.power).toBe(true);
      expect(scene.devices[1]!.state.power).toBe(true);
      // Should use different colors from vibrant palette
      expect(scene.devices[0]!.state.hue).not.toBe(scene.devices[1]!.state.hue);
    });

    it('should create off scene template', () => {
      const devices = [mockDevice];
      const scene = SCENE_TEMPLATES.off(devices);

      expect(scene.options.name).toBe('All Off');
      expect(scene.devices).toHaveLength(1);
      expect(scene.devices[0]!.state.power).toBe(false);
    });
  });

  describe('Scene Manager', () => {
    let manager: ReturnType<typeof createSceneManager>;

    beforeEach(() => {
      manager = createSceneManager();
    });

    it('should add and retrieve scenes', () => {
      const scene = createScene({ name: 'Test Scene' });
      manager.addScene(scene);

      expect(manager.getScene('Test Scene')).toBe(scene);
      expect(manager.listScenes()).toContain('Test Scene');
    });

    it('should remove scenes', () => {
      const scene = createScene({ name: 'Test Scene' });
      manager.addScene(scene);
      manager.removeScene('Test Scene');

      expect(manager.getScene('Test Scene')).toBeUndefined();
      expect(manager.listScenes()).not.toContain('Test Scene');
    });

    it('should apply scenes by name', async () => {
      const scene = createScene({ name: 'Test Scene' })
        .addDevice(mockDevice, validDeviceState);
      
      manager.addScene(scene);

      // Mock the scene.apply method
      const applySpy = jest.fn().mockResolvedValue(undefined);
      scene.apply = applySpy;

      await manager.applyScene('Test Scene', mockClient);

      expect(applySpy).toHaveBeenCalledWith(mockClient, undefined);
    });

    it('should throw error for non-existent scene', async () => {
      await expect(async () => {
        await manager.applyScene('Non-existent', mockClient);
      }).toThrow('Scene "Non-existent" not found');
    });

    it('should export and import scenes', () => {
      const scene1 = createScene({ name: 'Scene 1' }).addDevice(mockDevice, validDeviceState);
      const scene2 = createScene({ name: 'Scene 2' }).addDevice(mockDevice, validDeviceState);
      
      manager.addScene(scene1);
      manager.addScene(scene2);

      const exported = manager.exportScenes();
      expect(exported).toHaveProperty('Scene 1');
      expect(exported).toHaveProperty('Scene 2');

      const newManager = createSceneManager();
      const deviceResolver = (serialNumber: string, address: string, port: number) => 
        Device({ serialNumber, address, port });
      
      newManager.importScenes(exported, deviceResolver);

      expect(newManager.listScenes()).toContain('Scene 1');
      expect(newManager.listScenes()).toContain('Scene 2');
    });
  });
});