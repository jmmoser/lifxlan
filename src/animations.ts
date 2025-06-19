import type { ClientInstance } from './client.js';
import type { Device } from './devices.js';
import type { Scene, DeviceState } from './scenes.js';
import { SetColorCommand, SetPowerCommand } from './commands/index.js';

export type EasingFunction = (t: number) => number;

/**
 * Common easing functions for animations
 */
export const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  linear: (t: number) => t,
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => 1 - Math.pow(1 - t, 2),
  'ease-in-out': (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  'ease-in-cubic': (t: number) => t * t * t,
  'ease-out-cubic': (t: number) => 1 - Math.pow(1 - t, 3),
  'ease-in-out-cubic': (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  bounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
};

export interface AnimationOptions {
  /** Animation duration in milliseconds */
  duration: number;
  /** Easing function name or custom function */
  easing?: keyof typeof EASING_FUNCTIONS | EasingFunction;
  /** Update interval in milliseconds (default: 50ms = 20fps) */
  interval?: number;
  /** Delay before starting animation */
  delay?: number;
  /** Callback for each animation frame */
  onFrame?: (progress: number, state: DeviceState) => void;
  /** Callback when animation completes */
  onComplete?: () => void;
}

export interface ColorAnimation {
  /** Start the animation */
  start(): Promise<void>;
  /** Stop the animation */
  stop(): void;
  /** Check if animation is running */
  isRunning(): boolean;
}

/**
 * Linearly interpolate between two values
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Interpolate between two device states
 */
function interpolateDeviceState(from: DeviceState, to: DeviceState, t: number): DeviceState {
  return {
    power: t < 0.5 ? from.power : to.power, // Switch power at halfway point
    hue: Math.round(lerp(from.hue, to.hue, t)),
    saturation: Math.round(lerp(from.saturation, to.saturation, t)),
    brightness: Math.round(lerp(from.brightness, to.brightness, t)),
    kelvin: Math.round(lerp(from.kelvin, to.kelvin, t)),
    label: to.label,
  };
}

/**
 * Create a color animation between two device states
 */
export function createDeviceAnimation(
  client: ClientInstance,
  device: Device,
  fromState: DeviceState,
  toState: DeviceState,
  options: AnimationOptions
): ColorAnimation {
  let isRunning = false;
  let animationId: NodeJS.Timeout | number | null = null;
  
  const easingFn = typeof options.easing === 'function' 
    ? options.easing 
    : EASING_FUNCTIONS[options.easing || 'linear'] || EASING_FUNCTIONS.linear;
  
  const animation: ColorAnimation = {
    async start(): Promise<void> {
      if (isRunning) return;
      
      isRunning = true;
      const startTime = Date.now();
      const interval = options.interval || 50;
      
      if (options.delay && options.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
      
      return new Promise((resolve, reject) => {
        const animate = async () => {
          if (!isRunning) {
            resolve();
            return;
          }
          
          const elapsed = Date.now() - startTime - (options.delay || 0);
          const progress = Math.min(elapsed / options.duration, 1);
          const easedProgress = easingFn!(progress);
          
          const currentState = interpolateDeviceState(fromState, toState, easedProgress);
          
          try {
            // Send commands to device
            if (currentState.power !== fromState.power && progress > 0.5) {
              await client.send(SetPowerCommand(currentState.power), device);
            }
            
            if (currentState.power) {
              await client.send(
                SetColorCommand(
                  currentState.hue,
                  currentState.saturation,
                  currentState.brightness,
                  currentState.kelvin,
                  0 // No duration since we're controlling the timing
                ),
                device
              );
            }
            
            options.onFrame?.(progress, currentState);
            
            if (progress >= 1) {
              isRunning = false;
              options.onComplete?.();
              resolve();
              return;
            }
            
            animationId = setTimeout(animate, interval);
          } catch (error) {
            isRunning = false;
            reject(error);
          }
        };
        
        animate();
      });
    },
    
    stop(): void {
      isRunning = false;
      if (animationId) {
        clearTimeout(animationId);
        animationId = null;
      }
    },
    
    isRunning(): boolean {
      return isRunning;
    },
  };
  
  return animation;
}

/**
 * Create an animation that transitions between multiple scenes
 */
export function createSceneSequence(
  client: ClientInstance,
  scenes: Scene[],
  options: AnimationOptions & { holdDuration?: number }
): ColorAnimation {
  let isRunning = false;
  
  const animation: ColorAnimation = {
    async start(): Promise<void> {
      if (isRunning || scenes.length === 0) return;
      
      isRunning = true;
      
      try {
        for (let i = 0; i < scenes.length && isRunning; i++) {
          const scene = scenes[i];
          if (!scene) continue;
          
          // Apply the scene
          await scene.apply(client, { duration: options.duration });
          
          // Hold the scene for specified duration
          if (options.holdDuration && options.holdDuration > 0 && i < scenes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, options.holdDuration));
          }
        }
        
        options.onComplete?.();
      } catch (error) {
        isRunning = false;
        throw error;
      }
      
      isRunning = false;
    },
    
    stop(): void {
      isRunning = false;
    },
    
    isRunning(): boolean {
      return isRunning;
    },
  };
  
  return animation;
}

/**
 * Create a breathing/pulsing animation
 */
export function createBreathingAnimation(
  client: ClientInstance,
  device: Device,
  baseState: DeviceState,
  options: AnimationOptions & { 
    minBrightness?: number; 
    maxBrightness?: number;
    cycles?: number;
  }
): ColorAnimation {
  let isRunning = false;
  let animationId: NodeJS.Timeout | number | null = null;
  
  const minBrightness = options.minBrightness || Math.round(baseState.brightness * 0.3);
  const maxBrightness = options.maxBrightness || baseState.brightness;
  const cycles = options.cycles || Infinity;
  let currentCycle = 0;
  
  const animation: ColorAnimation = {
    async start(): Promise<void> {
      if (isRunning) return;
      
      isRunning = true;
      const startTime = Date.now();
      const interval = options.interval || 50;
      const easingFn = typeof options.easing === 'function' 
        ? options.easing 
        : EASING_FUNCTIONS[options.easing || 'ease-in-out'] || EASING_FUNCTIONS['ease-in-out'];
      
      if (options.delay && options.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
      
      return new Promise((resolve, reject) => {
        const animate = async () => {
          if (!isRunning || currentCycle >= cycles) {
            isRunning = false;
            options.onComplete?.();
            resolve();
            return;
          }
          
          const elapsed = Date.now() - startTime - (options.delay || 0);
          const cycleProgress = (elapsed % options.duration) / options.duration;
          const easedProgress = easingFn!(cycleProgress);
          
          // Create breathing effect: 0 -> 1 -> 0
          const breathingProgress = Math.sin(easedProgress * Math.PI);
          const brightness = Math.round(lerp(minBrightness, maxBrightness, breathingProgress));
          
          const currentState: DeviceState = {
            ...baseState,
            brightness,
          };
          
          try {
            if (currentState.power) {
              await client.send(
                SetColorCommand(
                  currentState.hue,
                  currentState.saturation,
                  currentState.brightness,
                  currentState.kelvin,
                  0
                ),
                device
              );
            }
            
            options.onFrame?.(cycleProgress, currentState);
            
            // Check if we completed a cycle
            if (elapsed > 0 && Math.floor(elapsed / options.duration) > currentCycle) {
              currentCycle++;
            }
            
            animationId = setTimeout(animate, interval);
          } catch (error) {
            isRunning = false;
            reject(error);
          }
        };
        
        animate();
      });
    },
    
    stop(): void {
      isRunning = false;
      if (animationId) {
        clearTimeout(animationId);
        animationId = null;
      }
    },
    
    isRunning(): boolean {
      return isRunning;
    },
  };
  
  return animation;
}

/**
 * Create a color cycling animation
 */
export function createColorCycleAnimation(
  client: ClientInstance,
  device: Device,
  baseState: DeviceState,
  options: AnimationOptions & { hueRange?: [number, number] }
): ColorAnimation {
  let isRunning = false;
  let animationId: NodeJS.Timeout | number | null = null;
  
  const [minHue, maxHue] = options.hueRange || [0, 65535];
  
  const animation: ColorAnimation = {
    async start(): Promise<void> {
      if (isRunning) return;
      
      isRunning = true;
      const startTime = Date.now();
      const interval = options.interval || 100;
      
      if (options.delay && options.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
      
      return new Promise((resolve, reject) => {
        const animate = async () => {
          if (!isRunning) {
            options.onComplete?.();
            resolve();
            return;
          }
          
          const elapsed = Date.now() - startTime - (options.delay || 0);
          const progress = (elapsed % options.duration) / options.duration;
          
          const currentHue = Math.round(lerp(minHue, maxHue, progress));
          
          const currentState: DeviceState = {
            ...baseState,
            hue: currentHue,
          };
          
          try {
            if (currentState.power) {
              await client.send(
                SetColorCommand(
                  currentState.hue,
                  currentState.saturation,
                  currentState.brightness,
                  currentState.kelvin,
                  0
                ),
                device
              );
            }
            
            options.onFrame?.(progress, currentState);
            
            animationId = setTimeout(animate, interval);
          } catch (error) {
            isRunning = false;
            reject(error);
          }
        };
        
        animate();
      });
    },
    
    stop(): void {
      isRunning = false;
      if (animationId) {
        clearTimeout(animationId);
        animationId = null;
      }
    },
    
    isRunning(): boolean {
      return isRunning;
    },
  };
  
  return animation;
}

/**
 * Animation manager for handling multiple concurrent animations
 */
export interface AnimationManager {
  /** Start an animation with a given name */
  start(name: string, animation: ColorAnimation): Promise<void>;
  
  /** Stop an animation by name */
  stop(name: string): void;
  
  /** Stop all running animations */
  stopAll(): void;
  
  /** Check if an animation is running */
  isRunning(name: string): boolean;
  
  /** List all animation names */
  listAnimations(): string[];
  
  /** Get running animation count */
  getRunningCount(): number;
}

/**
 * Create an animation manager
 */
export function createAnimationManager(): AnimationManager {
  const animations = new Map<string, ColorAnimation>();
  
  return {
    async start(name: string, animation: ColorAnimation): Promise<void> {
      // Stop existing animation with same name
      const existing = animations.get(name);
      if (existing?.isRunning()) {
        existing.stop();
      }
      
      animations.set(name, animation);
      await animation.start();
    },
    
    stop(name: string): void {
      const animation = animations.get(name);
      if (animation) {
        animation.stop();
      }
    },
    
    stopAll(): void {
      for (const animation of animations.values()) {
        animation.stop();
      }
    },
    
    isRunning(name: string): boolean {
      const animation = animations.get(name);
      return animation?.isRunning() || false;
    },
    
    listAnimations(): string[] {
      return Array.from(animations.keys());
    },
    
    getRunningCount(): number {
      return Array.from(animations.values()).filter(a => a.isRunning()).length;
    },
  };
}