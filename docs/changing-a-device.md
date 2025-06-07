The LIFX protocol supports `Set` messages which are used to change metadata or the visual appearance of a device. These messages also return `State` messages like the `Get` messages do when you specify `res_required=1`.

Note however that if your `Set` messages changes the visual appearance of the light it is likely you'll get the state of the device before your change.

# Device   [Skip link to Device](https://lan.developer.lifx.com/docs/changing-a-device\#device)

### SetPower - Packet 21   [Skip link to SetPower - Packet 21](https://lan.developer.lifx.com/docs/changing-a-device\#setpower---packet-21)

This packet lets you set the current level of power on the device.

Will return one [StatePower (22)](https://lan.developer.lifx.com/docs/information-messages#statepower---packet-22) message

|  |
| --- |
|  |
| `level`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16)<br>If you specify `0` the light will turn off and if you specify `65535` the device will turn on. |

### SetLabel - Packet 24   [Skip link to SetLabel - Packet 24](https://lan.developer.lifx.com/docs/changing-a-device\#setlabel---packet-24)

This packet lets you set the `label` on the device. The label is a string you assign to the device and will be displayed as the name of the device in the LIFX mobile apps.

Will return one [StateLabel (25)](https://lan.developer.lifx.com/docs/information-messages#statelabel---packet-25) message

|  |
| --- |
|  |
| `label`: 32 bytes [String](https://lan.developer.lifx.com/docs/field-types#string)<br>The string you want to assign. |

### SetReboot - Packet 38   [Skip link to SetReboot - Packet 38](https://lan.developer.lifx.com/docs/changing-a-device\#setreboot---packet-38)

This packet will instruct the device to perform a reboot similar to if it had been power cycled.

### SetLocation - Packet 49   [Skip link to SetLocation - Packet 49](https://lan.developer.lifx.com/docs/changing-a-device\#setlocation---packet-49)

This packet lets you set the `location` information on the device.

Will return one [StateLocation (50)](https://lan.developer.lifx.com/docs/information-messages#statelocation---packet-50) message

|  |
| --- |
|  |
| `location`: 16 [Bytes](https://lan.developer.lifx.com/docs/field-types#bytes) `16` bytes representing a `UUID` of the location. You should have the same `UUID` value for each device in this location |
| `label`: 32 bytes [String](https://lan.developer.lifx.com/docs/field-types#string)<br>The name of the location. |
| `updated_at`: [Uint64](https://lan.developer.lifx.com/docs/field-types#uint64)<br>The time you updated the location of this device as an epoch in nanoseconds. |

### SetGroup - Packet 52   [Skip link to SetGroup - Packet 52](https://lan.developer.lifx.com/docs/changing-a-device\#setgroup---packet-52)

This packet lets you set the `group` information on the device.

Will return one [StateGroup (53)](https://lan.developer.lifx.com/docs/information-messages#stategroup---packet-53) message

|  |
| --- |
|  |
| `group`: 16 [Bytes](https://lan.developer.lifx.com/docs/field-types#bytes) `16` bytes representing a `UUID` of the group. You should have the same `UUID` value for each device in this group |
| `label`: 32 bytes [String](https://lan.developer.lifx.com/docs/field-types#string)<br>The name of the group. |
| `updated_at`: [Uint64](https://lan.developer.lifx.com/docs/field-types#uint64)<br>The time you updated the group of this device as an epoch in nanoseconds. |

# Light   [Skip link to Light](https://lan.developer.lifx.com/docs/changing-a-device\#light)

### SetColor - Packet 102   [Skip link to SetColor - Packet 102](https://lan.developer.lifx.com/docs/changing-a-device\#setcolor---packet-102)

This packet lets you set the [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) value for the light. For devices that have multiple zones, this will set all Zones on the device to this color.

Will return one [LightState (107)](https://lan.developer.lifx.com/docs/information-messages#lightstate---packet-107) message

|  |
| --- |
|  |
| `reserved6`: 1 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `hue`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `saturation`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `brightness`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `kelvin`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `duration`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>The time it will take to transition to the new [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) in milliseconds. |

### SetWaveform - Packet 103   [Skip link to SetWaveform - Packet 103](https://lan.developer.lifx.com/docs/changing-a-device\#setwaveform---packet-103)

This packet lets you set the [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) and [Waveforms](https://lan.developer.lifx.com/docs/waveforms) value for the light. For devices that have multiple zones, this will treat all the zones on the device as one.

Will return one [LightState (107)](https://lan.developer.lifx.com/docs/information-messages#lightstate---packet-107) message

|  |
| --- |
|  |
| `reserved6`: 1 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `transient`: [BoolInt](https://lan.developer.lifx.com/docs/field-types#boolint)<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `hue`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `saturation`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `brightness`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `kelvin`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `period`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `cycles`: [Float](https://lan.developer.lifx.com/docs/field-types#float)<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `skew_ratio`: [Int16](https://lan.developer.lifx.com/docs/field-types#int16)<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `waveform`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8) using [Waveform](https://lan.developer.lifx.com/docs/field-types#waveform) Enum<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |

### SetLightPower - Packet 117   [Skip link to SetLightPower - Packet 117](https://lan.developer.lifx.com/docs/changing-a-device\#setlightpower---packet-117)

This is the same as [SetPower (21)](https://lan.developer.lifx.com/docs/changing-a-device#setpower---packet-21) but allows you to specify how long it will take to transition to the new power state.

Will return one [StateLightPower (118)](https://lan.developer.lifx.com/docs/information-messages#statelightpower---packet-118) message

|  |
| --- |
|  |
| `level`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16)<br>If you specify `0` the light will turn off and if you specify `65535` the device will turn on. |
| `duration`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>The time it will take to transition to the new state in milliseconds. |

### SetWaveformOptional - Packet 119   [Skip link to SetWaveformOptional - Packet 119](https://lan.developer.lifx.com/docs/changing-a-device\#setwaveformoptional---packet-119)

This behaves like [SetWaveform (103)](https://lan.developer.lifx.com/docs/changing-a-device#setwaveform---packet-103) but allows you to keep certain parts of the original [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) values during the transition.

Will return one [LightState (107)](https://lan.developer.lifx.com/docs/information-messages#lightstate---packet-107) message

|  |
| --- |
|  |
| `reserved6`: 1 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `transient`: [BoolInt](https://lan.developer.lifx.com/docs/field-types#boolint)<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `hue`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `saturation`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `brightness`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `kelvin`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `period`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `cycles`: [Float](https://lan.developer.lifx.com/docs/field-types#float)<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `skew_ratio`: [Int16](https://lan.developer.lifx.com/docs/field-types#int16)<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `waveform`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8) using [Waveform](https://lan.developer.lifx.com/docs/field-types#waveform) Enum<br>See [Waveforms](https://lan.developer.lifx.com/docs/waveforms) |
| `set_hue`: [BoolInt](https://lan.developer.lifx.com/docs/field-types#boolint)<br>Use the hue value in this message |
| `set_saturation`: [BoolInt](https://lan.developer.lifx.com/docs/field-types#boolint)<br>Use the saturation value in this message |
| `set_brightness`: [BoolInt](https://lan.developer.lifx.com/docs/field-types#boolint)<br>Use the brightness value in this message |
| `set_kelvin`: [BoolInt](https://lan.developer.lifx.com/docs/field-types#boolint)<br>Use the kelvin value in this message |

### SetInfrared - Packet 122   [Skip link to SetInfrared - Packet 122](https://lan.developer.lifx.com/docs/changing-a-device\#setinfrared---packet-122)

This packet lets you change the current infrared value on the device

Will return one [StateInfrared (121)](https://lan.developer.lifx.com/docs/information-messages#stateinfrared---packet-121) message

This packet requires the device has the `infrared` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `brightness`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16)<br>The amount of infrared emitted by the device. `0` is no infrared and `65535` is the most infrared. |

### SetHevCycle - Packet 143   [Skip link to SetHevCycle - Packet 143](https://lan.developer.lifx.com/docs/changing-a-device\#sethevcycle---packet-143)

This packet lets you start or stop a HEV cycle on the device.

Will return one [StateHevCycle (144)](https://lan.developer.lifx.com/docs/information-messages#statehevcycle---packet-144) message

This packet requires the device has the `hev` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `enable`: [BoolInt](https://lan.developer.lifx.com/docs/field-types#boolint)<br>Set this to false to turn off the cycle and true to start the cycle |
| `duration_s`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>The duration, in seconds that the cycle should last for. A value of 0 will use the default duration set by [SetHevCycleConfiguration (146)](https://lan.developer.lifx.com/docs/changing-a-device#sethevcycleconfiguration---packet-146). |

### SetHevCycleConfiguration - Packet 146   [Skip link to SetHevCycleConfiguration - Packet 146](https://lan.developer.lifx.com/docs/changing-a-device\#sethevcycleconfiguration---packet-146)

This packet lets you set default values for a HEV cycle on the device

Will return one [StateHevCycleConfiguration (147)](https://lan.developer.lifx.com/docs/information-messages#statehevcycleconfiguration---packet-147) message

This packet requires the device has the `hev` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `indication`: [BoolInt](https://lan.developer.lifx.com/docs/field-types#boolint)<br>Set this to true to run a short flashing indication at the end of the HEV cycle |
| `duration_s`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>This is the default duration that is used when [SetHevCycle (143)](https://lan.developer.lifx.com/docs/changing-a-device#sethevcycle---packet-143) is given 0 for duration\_s. |

# MultiZone   [Skip link to MultiZone](https://lan.developer.lifx.com/docs/changing-a-device\#multizone)

### SetColorZones - Packet 501   [Skip link to SetColorZones - Packet 501](https://lan.developer.lifx.com/docs/changing-a-device\#setcolorzones---packet-501)

Set a segment of your strip to a [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) value. If your devices supports extended multizone messages it is recommended you use those messages instead.

Will return one [StateMultiZone (506)](https://lan.developer.lifx.com/docs/information-messages#statemultizone---packet-506) message

This packet requires the device has the `Linear Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `start_index`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The first zone in the segment we are changing. |
| `end_index`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The last zone in the segment we are changing |
| `hue`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `saturation`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `brightness`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `kelvin`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16) |
| `duration`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>The amount of time it takes to transition to the new values in milliseconds. |
| `apply`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8) using [MultiZoneApplicationRequest](https://lan.developer.lifx.com/docs/field-types#multizoneapplicationrequest) Enum |

### SetMultiZoneEffect - Packet 508   [Skip link to SetMultiZoneEffect - Packet 508](https://lan.developer.lifx.com/docs/changing-a-device\#setmultizoneeffect---packet-508)

Start a multizone [Firmware Effect](https://lan.developer.lifx.com/docs/firmware-effects) on the device.

Will return one [StateMultiZoneEffect (509)](https://lan.developer.lifx.com/docs/information-messages#statemultizoneeffect---packet-509) message

This packet requires the device has the `Linear Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `instanceid`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>A unique number identifying this effect. |
| `type`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8) using [MultiZoneEffectType](https://lan.developer.lifx.com/docs/field-types#multizoneeffecttype) Enum |
| `reserved6`: 2 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `speed`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>The time it takes for one cycle of the effect in milliseconds. |
| `duration`: [Uint64](https://lan.developer.lifx.com/docs/field-types#uint64)<br>The time the effect will run for in nanoseconds. |
| `reserved7`: 4 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `reserved8`: 4 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `parameters`: 32 [Bytes](https://lan.developer.lifx.com/docs/field-types#bytes)<br>This field is **8** `4` byte fields which change meaning based on the effect that is running. When the effect is `MOVE` only the second field is used and is a [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32) representing the [DIRECTION](https://lan.developer.lifx.com/docs/field-types#direction) enum. This field is currently ignored for all other multizone effects. |

### SetExtendedColorZones - Packet 510   [Skip link to SetExtendedColorZones - Packet 510](https://lan.developer.lifx.com/docs/changing-a-device\#setextendedcolorzones---packet-510)

This message lets you change the [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) values for all zones on the strip in one message.

Will return one [StateExtendedColorZones (512)](https://lan.developer.lifx.com/docs/information-messages#stateextendedcolorzones---packet-512) message

This packet requires the device has the `Extended Linear Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `duration`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>The time it takes to transition to the new values in milliseconds. |
| `apply`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8) using [MultiZoneExtendedApplicationRequest](https://lan.developer.lifx.com/docs/field-types#multizoneextendedapplicationrequest) Enum<br>Whether to make this change now |
| `zone_index`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16)<br>The first zone to apply `colors` from. If the light has more than 82 zones, then send multiple messages with different indices to update the whole device. |
| `colors_count`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The number of colors in the `colors` field to apply to the strip |
| `colors`: 82 [Color](https://lan.developer.lifx.com/docs/field-types#color) structures<br>The [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) values to change the strip with. |

# Relay   [Skip link to Relay](https://lan.developer.lifx.com/docs/changing-a-device\#relay)

### SetRPower - Packet 817   [Skip link to SetRPower - Packet 817](https://lan.developer.lifx.com/docs/changing-a-device\#setrpower---packet-817)

Set the power state of a relay on a switch device. Current models of the LIFX switch do not have dimming capability, so the two valid values are `0` for `off` and `65535` for `on`.

Will return one [StateRPower (818)](https://lan.developer.lifx.com/docs/information-messages#staterpower---packet-818) message

This packet requires the device has the `Relays` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `relay_index`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The relay on the switch starting from `0`. |
| `level`: [Uint16](https://lan.developer.lifx.com/docs/field-types#uint16)<br>The new value of the relay |

# Tile   [Skip link to Tile](https://lan.developer.lifx.com/docs/changing-a-device\#tile)

### SetUserPosition - Packet 703   [Skip link to SetUserPosition - Packet 703](https://lan.developer.lifx.com/docs/changing-a-device\#setuserposition---packet-703)

Allows you to specify the position of this device in the chain relative to other device in the chain.

You can find more information about this data by looking at [Tile Positions](https://lan.developer.lifx.com/docs/tile-control#tile-positioning).

This message has no response packet even if you set `res_required=1`.

This packet requires the device has the `Matrix Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `tile_index`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The device to change. This is `0` indexed and starts from the device closest to the controller. |
| `reserved6`: 2 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `user_x`: [Float](https://lan.developer.lifx.com/docs/field-types#float) |
| `user_y`: [Float](https://lan.developer.lifx.com/docs/field-types#float) |

### Set64 - Packet 715   [Skip link to Set64 - Packet 715](https://lan.developer.lifx.com/docs/changing-a-device\#set64---packet-715)

This lets you set up to `64` [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) values on the device.

This message has no response packet even if you set `res_required=1`.

This packet requires the device has the `Matrix Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `tile_index`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The device to change. This is `0` indexed and starts from the device closest to the controller. |
| `length`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The number of devices in the chain to change starting from `tile_index` |
| `reserved6`: 1 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `x`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The x co-ordinate to start applying colors from. You likely want this to be `0`. |
| `y`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The y co-ordinate to start applying colors from. You likely want this to be `0`. |
| `width`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The width of the square you're applying colors to. This should be `8` for the LIFX Tile and `5` for the LIFX Candle. |
| `duration`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>The time it will take to transition to new state in milliseconds. |
| `colors`: 64 [Color](https://lan.developer.lifx.com/docs/field-types#color) structures<br>The [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) values to assign to each zone specified by this packet. |

### SetTileEffect - Packet 719   [Skip link to SetTileEffect - Packet 719](https://lan.developer.lifx.com/docs/changing-a-device\#settileeffect---packet-719)

This packet will let you start a [Firmware Effect](https://lan.developer.lifx.com/docs/firmware-effects) on the device.

Will return one [StateTileEffect (720)](https://lan.developer.lifx.com/docs/information-messages#statetileeffect---packet-720) message

This packet requires the device has the `Matrix Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

_Note: The Sky effect is only supported on LIFX Ceiling, running firmware 4.4 or higher_

|  |
| --- |
|  |
| `reserved0`: 1 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `reserved1`: 1 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `instanceid`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>A unique number identifying this effect. |
| `type`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8) using [TileEffectType](https://lan.developer.lifx.com/docs/field-types#tileeffecttype) Enum |
| `speed`: [Uint32](https://lan.developer.lifx.com/docs/field-types#uint32)<br>The time it takes for one cycle of the effect in milliseconds. |
| `duration`: [Uint64](https://lan.developer.lifx.com/docs/field-types#uint64)<br>The time the effect will run for in nanoseconds. |
| `reserved2`: 4 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `reserved3`: 4 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `skyType`: [TileEffectSkyType](https://lan.developer.lifx.com/docs/field-types#tileeffectskytype) only used on `SKY` effect |
| `reserved4`: 3 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `cloudSaturationMin` 1 [Bytes](https://lan.developer.lifx.com/docs/field-types#bytes) only used on `SKY` effect when using `CLOUDS` (recommended default is 50) |
| `reserved5`: 3 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `reserved6`: 24 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes<br>This field is currently ignored by all firmware effects. |
| `palette_count`: [Uint8](https://lan.developer.lifx.com/docs/field-types#uint8)<br>The number of values in `palette` that you want to use. |
| `palette`: 16 [Color](https://lan.developer.lifx.com/docs/field-types#color) structures<br>The [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) values to be used by the effect. On the `MORPH` effect this is used as the palette for generating the effect. With the `SKY` effect, the indices specified in [TileEffectSkyPalette](https://lan.developer.lifx.com/docs/field-types#tileeffectskypalette) dictate how each color will be used. |

Updatedabout 2 months ago

* * *