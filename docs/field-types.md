## Simple types   [Skip link to Simple types](https://lan.developer.lifx.com/docs/field-types\#simple-types)

### Uint8   [Skip link to Uint8](https://lan.developer.lifx.com/docs/field-types\#uint8)

A `1` byte positive integer.

### Uint16   [Skip link to Uint16](https://lan.developer.lifx.com/docs/field-types\#uint16)

A `2` byte positive integer.

### Uint32   [Skip link to Uint32](https://lan.developer.lifx.com/docs/field-types\#uint32)

A `4` byte positive integer.

### Uint64   [Skip link to Uint64](https://lan.developer.lifx.com/docs/field-types\#uint64)

An `8` byte positive integer

### Int16   [Skip link to Int16](https://lan.developer.lifx.com/docs/field-types\#int16)

A `2` byte negative or positive integer

### Float   [Skip link to Float](https://lan.developer.lifx.com/docs/field-types\#float)

A `4` byte float

### Bytes   [Skip link to Bytes](https://lan.developer.lifx.com/docs/field-types\#bytes)

An array of bytes

### String   [Skip link to String](https://lan.developer.lifx.com/docs/field-types\#string)

A `NULL` terminated unicode string

### Bool   [Skip link to Bool](https://lan.developer.lifx.com/docs/field-types\#bool)

A `1` **bit** representing `true` or `false`

### BoolInt   [Skip link to BoolInt](https://lan.developer.lifx.com/docs/field-types\#boolint)

A `1` byte integer where `0` represents `false` and `1` represents `true`

### Reserved   [Skip link to Reserved](https://lan.developer.lifx.com/docs/field-types\#reserved)

These are bytes that are reserved for future use. You should always set these to `0`.

## Structures   [Skip link to Structures](https://lan.developer.lifx.com/docs/field-types\#structures)

### Color   [Skip link to Color](https://lan.developer.lifx.com/docs/field-types\#color)

This packet represents a single [HSBK](doc:representing-color-with-hsbk) value. It is used in packets that set a different [HSBK](doc:representing-color-with-hsbk) value for devices with multiple zones.

|  |
| --- |
|  |
| `hue`: [Uint16](doc:field-types#uint16) |
| `saturation`: [Uint16](doc:field-types#uint16) |
| `brightness`: [Uint16](doc:field-types#uint16) |
| `kelvin`: [Uint16](doc:field-types#uint16) |

### Tile   [Skip link to Tile](https://lan.developer.lifx.com/docs/field-types\#tile)

This represents the information for a single device in a chain. It is used by the [StateDeviceChain (702)](doc:information-messages#statedevicechain---packet-702) packet

|  |
| --- |
|  |
| `accel_meas_x`: [Int16](doc:field-types#int16)<br>See [Tile Orientation](doc:tile-control#tile-orientation) |
| `accel_meas_y`: [Int16](doc:field-types#int16)<br>See [Tile Orientation](doc:tile-control#tile-orientation) |
| `accel_meas_z`: [Int16](doc:field-types#int16)<br>See [Tile Orientation](doc:tile-control#tile-orientation) |
| `reserved6`: 2 [Reserved](doc:field-types#reserved) bytes |
| `user_x`: [Float](doc:field-types#float)<br>See [Tile Positions](doc:tile-control#tile-positioning) |
| `user_y`: [Float](doc:field-types#float)<br>See [Tile Positions](doc:tile-control#tile-positioning) |
| `width`: [Uint8](doc:field-types#uint8)<br>The number of zones that make up each row |
| `height`: [Uint8](doc:field-types#uint8)<br>The number of zones that make up each column |
| `reserved7`: 1 [Reserved](doc:field-types#reserved) bytes |
| `device_version_vendor`: [Uint32](doc:field-types#uint32)<br>The vendor id of the device (See [StateVersion (33)](doc:information-messages#stateversion---packet-33)) |
| `device_version_product`: [Uint32](doc:field-types#uint32)<br>The product id of the device (See [StateVersion (33)](doc:information-messages#stateversion---packet-33)) |
| `reserved8`: 4 [Reserved](doc:field-types#reserved) bytes |
| `firmware_build`: [Uint64](doc:field-types#uint64)<br>The epoch of the time the firmware was created (See [StateHostFirmware (15)](doc:information-messages#statehostfirmware---packet-15)) |
| `reserved9`: 8 [Reserved](doc:field-types#reserved) bytes |
| `firmware_version_minor`: [Uint16](doc:field-types#uint16)<br>The minor component of the firmware version (See [StateHostFirmware (15)](doc:information-messages#statehostfirmware---packet-15)) |
| `firmware_version_major`: [Uint16](doc:field-types#uint16)<br>The major component of the firmware version (See [StateHostFirmware (15)](doc:information-messages#statehostfirmware---packet-15)) |
| `reserved10`: 4 [Reserved](doc:field-types#reserved) bytes |

## Enums   [Skip link to Enums](https://lan.developer.lifx.com/docs/field-types\#enums)

### Services   [Skip link to Services](https://lan.developer.lifx.com/docs/field-types\#services)

_UInt8_

- **1**: UDP
- **2**: RESERVED1
- **3**: RESERVED2
- **4**: RESERVED3
- **5**: RESERVED4

### Direction   [Skip link to Direction](https://lan.developer.lifx.com/docs/field-types\#direction)

_UInt8_

- **0**: REVERSED (moving towards zone 0)
- **1**: NOT\_REVERSED (moving away from zone 0)

### Waveform   [Skip link to Waveform](https://lan.developer.lifx.com/docs/field-types\#waveform)

_UInt8_

- **0**: SAW
- **1**: SINE
- **2**: HALF\_SINE
- **3**: TRIANGLE
- **4**: PULSE

### MultiZoneApplicationRequest   [Skip link to MultiZoneApplicationRequest](https://lan.developer.lifx.com/docs/field-types\#multizoneapplicationrequest)

_UInt8_

- **0**: NO\_APPLY
- **1**: APPLY
- **2**: APPLY\_ONLY

### MultiZoneEffectType   [Skip link to MultiZoneEffectType](https://lan.developer.lifx.com/docs/field-types\#multizoneeffecttype)

_UInt8_

- **0**: OFF
- **1**: MOVE
- **2**: RESERVED1
- **3**: RESERVED2

### MultiZoneExtendedApplicationRequest   [Skip link to MultiZoneExtendedApplicationRequest](https://lan.developer.lifx.com/docs/field-types\#multizoneextendedapplicationrequest)

_UInt8_

- **0**: NO\_APPLY
- **1**: APPLY
- **2**: APPLY\_ONLY

### TileEffectType   [Skip link to TileEffectType](https://lan.developer.lifx.com/docs/field-types\#tileeffecttype)

_UInt8_

- **0**: OFF
- **1**: RESERVED1
- **2**: MORPH
- **3**: FLAME
- **4**: RESERVED2
- **5**: SKY

### TileEffectSkyType   [Skip link to TileEffectSkyType](https://lan.developer.lifx.com/docs/field-types\#tileeffectskytype)

_UInt8_

- **0**: SUNRISE
- **1**: SUNSET
- **2**: CLOUDS

### TileEffectSkyPalette   [Skip link to TileEffectSkyPalette](https://lan.developer.lifx.com/docs/field-types\#tileeffectskypalette)

_Note: This is not an enum, but a reference for the offsets used to specify different colors in the Sky Effect._

- **0**: SKY
- **1**: NIGHT\_SKY
- **2**: DAWN\_SKY
- **3**: DAWN\_SUN
- **4**: FULL\_SUN
- **5**: FINAL\_SUN

### LightLastHevCycleResult   [Skip link to LightLastHevCycleResult](https://lan.developer.lifx.com/docs/field-types\#lightlasthevcycleresult)

_UInt8_

- **0**: SUCCESS
- **1**: BUSY
- **2**: INTERRUPTED\_BY\_RESET
- **3**: INTERRUPTED\_BY\_HOMEKIT
- **4**: INTERRUPTED\_BY\_LAN
- **5**: INTERRUPTED\_BY\_CLOUD
- **255**: NONE

Updatedabout 2 months ago

* * *