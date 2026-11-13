/**
 * Low-level LIFX LAN wire-format access, published as the 'lifxlan/encoding'
 * subpath entry point. Every export here is public semver surface.
 *
 * It is the layer to reach for when decoding messages observed through a
 * router tap or driving a socket without Router/Client: `encode` builds a
 * complete message, `decodeHeader`/`getPayload` take one apart, and every
 * device-to-client message has a `decode*` function named after its `Type`
 * constant. The high-level API in the package root never requires importing
 * it — and request payloads are not built here: a command factory's
 * `payload` (e.g. `SetColor({ ... }).payload`) is those bytes.
 */
export {
  encode,
  decodeHeader,
  getPayload,
  decodeStateService,
  decodeStateHostFirmware,
  decodeStateWifiInfo,
  decodeStateWifiFirmware,
  decodeStatePower,
  decodeStateLabel,
  decodeStateVersion,
  decodeStateInfo,
  decodeStateLocation,
  decodeStateGroup,
  decodeEchoResponse,
  decodeStateUnhandled,
  decodeLightState,
  decodeStateLightPower,
  decodeStateInfrared,
  decodeStateHevCycle,
  decodeStateHevCycleConfiguration,
  decodeStateLastHevCycleResult,
  decodeStateRPower,
  decodeStateDeviceChain,
  decodeState64,
  decodeStateZone,
  decodeStateMultiZone,
  decodeStateMultiZoneEffect,
  decodeStateExtendedColorZones,
  decodeStateTileEffect,
  decodeSensorStateAmbientLight,
  decodeStateButton,
} from './wire.js';

export type {
  Header,
  Color,
  StateService,
  StateHostFirmware,
  StateWifiInfo,
  StateWifiFirmware,
  StateVersion,
  StateInfo,
  StateLocation,
  StateGroup,
  LightState,
  StateHevCycle,
  StateHevCycleConfiguration,
  StateRPower,
  StateDeviceChain,
  DeviceChainDevice,
  State64,
  StateZone,
  StateMultiZone,
  StateMultiZoneEffect,
  StateExtendedColorZones,
  StateTileEffect,
  SensorStateAmbientLight,
  StateButton,
  Button,
  ButtonAction,
  ButtonInput,
  ButtonActionInput,
} from './wire.js';
