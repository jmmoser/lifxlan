You will receive a State message to your request when you send a Get message or if your Set message has the `res_required` flag set to 1. Though typically you would only require acknowledgement from Set messages.

# Core   [Skip link to Core](https://lan.developer.lifx.com/docs/information-messages\#core)

### Acknowledgement - Packet 45   [Skip link to Acknowledgement - Packet 45](https://lan.developer.lifx.com/docs/information-messages\#acknowledgement---packet-45)

This packet is returned when you specify `ack_required=1`.

# Discovery   [Skip link to Discovery](https://lan.developer.lifx.com/docs/information-messages\#discovery)

### StateService - Packet 3   [Skip link to StateService - Packet 3](https://lan.developer.lifx.com/docs/information-messages\#stateservice---packet-3)

This packet is used to tell you what services are available and the port each service is on.

This packet is the reply to the [GetService (2)](doc:querying-the-device-for-data#getservice---packet-2) message

|  |
| --- |
|  |
| `service`: [Uint8](doc:field-types#uint8) using [Services](doc:field-types#services) Enum |
| `port`: [Uint32](doc:field-types#uint32)<br>The port of the service. This value is usually `56700` but you should not assume this is always the case. |

# Device   [Skip link to Device](https://lan.developer.lifx.com/docs/information-messages\#device)

### StateHostFirmware - Packet 15   [Skip link to StateHostFirmware - Packet 15](https://lan.developer.lifx.com/docs/information-messages\#statehostfirmware---packet-15)

This packet will tell you what version of firmware is on the device.

Typically you would use this information along with [StateVersion (33)](doc:information-messages#stateversion---packet-33) to determine the capabilities of your device as specified in our [Product Registry](doc:product-registry).

The `version_major` and `version_minor` should be thought of as a pair of `(major, minor)`. So say `major` is `3` and `minor` is `60`, then the version is `(3, 60)`. This means that `(2, 80)` is considered less than `(3, 60)` and `(3, 70)` is considered greater.

LIFX products will specify a different `major` for each generation of our devices.

This packet is the reply to the [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) message

|  |
| --- |
|  |
| `build`: [Uint64](doc:field-types#uint64)<br>The timestamp of the firmware that is on the device as an epoch |
| `reserved6`: 8 [Reserved](doc:field-types#reserved) bytes |
| `version_minor`: [Uint16](doc:field-types#uint16)<br>The minor component of the firmware version |
| `version_major`: [Uint16](doc:field-types#uint16)<br>The Major component of the firmware version |

### StateWifiInfo - Packet 17   [Skip link to StateWifiInfo - Packet 17](https://lan.developer.lifx.com/docs/information-messages\#statewifiinfo---packet-17)

This packet will give you information about the signal strength of the device.

The units of this field varies between different products, You can use the following pseudo code to determine the signal strength of your device.

```rdmd-code lang- theme-undefined
rssi = int(floor(10 * Log10(signal) + 0.5))

if rssi < 0 or rssi == 200:
    if rssi == 200:
        status = "No signal"
    else if rssi <= -80:
        status = "Very bad signal"
    else if rssi <= -70:
        status = "Somewhat bad signal"
    else if rssi <= -60:
        status = "Alright signal"
    else:
        status = "Good signal"

if rssi == 4 or rssi == 5 or rssi == 6:
    status = "Very bad signal"

elif rssi >= 7 and rssi <= 11:
    status = "Somewhat bad signal"

elif rssi >= 12 and rssi <= 16:
    status = "Alright signal";

elif rssi > 16:
    status = "Good signal"

else:
    status = "No signal"
```

This packet is the reply to the [GetWifiInfo (16)](doc:querying-the-device-for-data#getwifiinfo---packet-16) message

|  |
| --- |
|  |
| `signal`: [Float](doc:field-types#float)<br>The signal strength of the device. |
| `reserved6`: 4 [Reserved](doc:field-types#reserved) bytes |
| `reserved7`: 4 [Reserved](doc:field-types#reserved) bytes |
| `reserved8`: 2 [Reserved](doc:field-types#reserved) bytes |

### StateWifiFirmware - Packet 19   [Skip link to StateWifiFirmware - Packet 19](https://lan.developer.lifx.com/docs/information-messages\#statewififirmware---packet-19)

This packet is the reply to the [GetWifiFirmware (18)](doc:querying-the-device-for-data#getwififirmware---packet-18) message

|  |
| --- |
|  |
| `build`: [Uint64](doc:field-types#uint64)<br>The timestamp when the wifi firmware was created as an epoch, This is only relevant for the first two generations of our products. |
| `reserved6`: 8 [Reserved](doc:field-types#reserved) bytes |
| `version_minor`: [Uint16](doc:field-types#uint16)<br>The `minor` component of the version. |
| `version_major`: [Uint16](doc:field-types#uint16)<br>The `major` component of the version. |

### StatePower - Packet 22   [Skip link to StatePower - Packet 22](https://lan.developer.lifx.com/docs/information-messages\#statepower---packet-22)

This packet tells us the current power level of the device. `0` means off and any other value means on. Note that `65535` is full power and during a power transition (i.e. via [SetLightPower (117)](doc:querying-the-device-for-data#setlightpower---packet-117)) the value may be any value between `0` and `65535`.

This packet is the reply to the [GetPower (20)](doc:querying-the-device-for-data#getpower---packet-20) and [SetPower (21)](doc:changing-a-device#setpower---packet-21) messages

|  |
| --- |
|  |
| `level`: [Uint16](doc:field-types#uint16)<br>The current level of the device's power. |

### StateLabel - Packet 25   [Skip link to StateLabel - Packet 25](https://lan.developer.lifx.com/docs/information-messages\#statelabel---packet-25)

This packet tells us the label of the device.

This packet is the reply to the [GetLabel (23)](doc:querying-the-device-for-data#getlabel---packet-23) and [SetLabel (24)](doc:changing-a-device#setlabel---packet-24) messages

|  |
| --- |
|  |
| `label`: 32 bytes [String](doc:field-types#string) |

### StateVersion - Packet 33   [Skip link to StateVersion - Packet 33](https://lan.developer.lifx.com/docs/information-messages\#stateversion---packet-33)

This packet tell us the version of the firmware on the device. This information can be used with our [Product Registry](doc:product-registry) to determine what capabilities are supported by the device.

This packet is the reply to the [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32) message

|  |
| --- |
|  |
| `vendor`: [Uint32](doc:field-types#uint32)<br>For LIFX products this value is `1`. There may be devices in the future with a different `vendor` value. |
| `product`: [Uint32](doc:field-types#uint32)<br>The product id of the device. The available products can be found in our [Product Registry](doc:product-registry). |
| `reserved6`: 4 [Reserved](doc:field-types#reserved) bytes |

### StateInfo - Packet 35   [Skip link to StateInfo - Packet 35](https://lan.developer.lifx.com/docs/information-messages\#stateinfo---packet-35)

This packet provides information about the device.

This packet is the reply to the [GetInfo (34)](doc:querying-the-device-for-data#getinfo---packet-34) message

|  |
| --- |
|  |
| `time`: [Uint64](doc:field-types#uint64)<br>The current time according to the device. Note that this is most likely inaccurate. |
| `uptime`: [Uint64](doc:field-types#uint64)<br>The amount of time in nanoseconds the device has been online since last power on |
| `downtime`: [Uint64](doc:field-types#uint64)<br>The amount of time in nanseconds of power off time accurate to 5 seconds. |

### StateLocation - Packet 50   [Skip link to StateLocation - Packet 50](https://lan.developer.lifx.com/docs/information-messages\#statelocation---packet-50)

This packet provides the details of the location set on the device.

To determine the label of a location you need to send a [GetLocation (48)](doc:querying-the-device-for-data#getlocation---packet-48) to all the devices you can find and for each location `uuid` determine which label is accompanied by the latest `updated_at` value.

This packet is the reply to the [GetLocation (48)](doc:querying-the-device-for-data#getlocation---packet-48) and [SetLocation (49)](doc:changing-a-device#setlocation---packet-49) messages

|  |
| --- |
|  |
| `location`: 16 [Bytes](doc:field-types#bytes)<br>The unique identifier of this group as a `uuid`. |
| `label`: 32 bytes [String](doc:field-types#string)<br>The name assigned to this location |
| `updated_at`: [Uint64](doc:field-types#uint64)<br>An epoch in nanoseconds of when this location was set on the device |

### StateGroup - Packet 53   [Skip link to StateGroup - Packet 53](https://lan.developer.lifx.com/docs/information-messages\#stategroup---packet-53)

This packet provides the details of the group set on the device.

To determine the label of a group you need to send a [GetGroup (51)](doc:querying-the-device-for-data#getgroup---packet-51) to all the devices you can find and for each group `uuid` determine which label is accompanied by the latest `updated_at` value.

This packet is the reply to the [GetGroup (51)](doc:querying-the-device-for-data#getgroup---packet-51) and [SetGroup (52)](doc:changing-a-device#setgroup---packet-52) messages

|  |
| --- |
|  |
| `group`: 16 [Bytes](doc:field-types#bytes)<br>The unique identifier of this group as a `uuid`. |
| `label`: 32 bytes [String](doc:field-types#string)<br>The name assigned to this group |
| `updated_at`: [Uint64](doc:field-types#uint64)<br>An epoch in nanoseconds of when this group was set on the device |

### EchoResponse - Packet 59   [Skip link to EchoResponse - Packet 59](https://lan.developer.lifx.com/docs/information-messages\#echoresponse---packet-59)

This tells you the same value you specified when you sent an [EchoRequest (58)](doc:querying-the-device-for-data#echorequest---packet-58) to the device.

|  |
| --- |
|  |
| `echoing`: 64 [Bytes](doc:field-types#bytes) |

### StateUnhandled - Packet 223   [Skip link to StateUnhandled - Packet 223](https://lan.developer.lifx.com/docs/information-messages\#stateunhandled---packet-223)

For some firmware, this packet is returned when the device receives a packet it does not know how to handle. For now, only the LIFX Switch has this behaviour.

It will return the type of packet it couldn't handle. For example, if you send a [GetColor (101)](doc:querying-the-device-for-data#getcolor---packet-101) to a LIFX switch, then you would receive one of these with a `unhandled_type` of 101.

|  |
| --- |
|  |
| `unhandled_type`: [Uint16](doc:field-types#uint16)<br>The type of the packet that was ignored. |

# Light   [Skip link to Light](https://lan.developer.lifx.com/docs/information-messages\#light)

### LightState - Packet 107   [Skip link to LightState - Packet 107](https://lan.developer.lifx.com/docs/information-messages\#lightstate---packet-107)

The current visual state of the device and it's label

This packet is the reply to [GetColor (101)](doc:querying-the-device-for-data#getcolor---packet-101), [SetColor (102)](doc:changing-a-device#setcolor---packet-102), [SetWaveform (103)](doc:changing-a-device#setwaveform---packet-103) and [SetWaveformOptional (119)](doc:changing-a-device#setwaveformoptional---packet-119) messages

|  |
| --- |
|  |
| `hue`: [Uint16](doc:field-types#uint16) |
| `saturation`: [Uint16](doc:field-types#uint16) |
| `brightness`: [Uint16](doc:field-types#uint16) |
| `kelvin`: [Uint16](doc:field-types#uint16) |
| `reserved6`: 2 [Reserved](doc:field-types#reserved) bytes |
| `power`: [Uint16](doc:field-types#uint16)<br>The current power level of the device. |
| `label`: 32 bytes [String](doc:field-types#string)<br>The current label on the device. |
| `reserved7`: 8 [Reserved](doc:field-types#reserved) bytes |

### StateLightPower - Packet 118   [Skip link to StateLightPower - Packet 118](https://lan.developer.lifx.com/docs/information-messages\#statelightpower---packet-118)

This says the current power level of the device.

This packet is the reply to the [GetLightPower (116)](doc:querying-the-device-for-data#getlightpower---packet-116) and [SetLightPower (117)](doc:changing-a-device#setlightpower---packet-117) messages

|  |
| --- |
|  |
| `level`: [Uint16](doc:field-types#uint16) |

### StateInfrared - Packet 121   [Skip link to StateInfrared - Packet 121](https://lan.developer.lifx.com/docs/information-messages\#stateinfrared---packet-121)

This says the current brightness of the infrared output from the device

This packet requires the device has the `infrared` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetInfrared (120)](doc:querying-the-device-for-data#getinfrared---packet-120) and [SetInfrared (122)](doc:changing-a-device#setinfrared---packet-122) messages

|  |
| --- |
|  |
| `brightness`: [Uint16](doc:field-types#uint16)<br>The amount of infrared. `0` is no infrared output and `65535` is full infrared output. |

### StateHevCycle - Packet 144   [Skip link to StateHevCycle - Packet 144](https://lan.developer.lifx.com/docs/information-messages\#statehevcycle---packet-144)

This says whether a HEV cycle is running on the device.

This packet requires the device has the `hev` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetHevCycle (142)](doc:querying-the-device-for-data#gethevcycle---packet-142) and [SetHevCycle (143)](doc:changing-a-device#sethevcycle---packet-143) messages

|  |
| --- |
|  |
| `duration_s`: [Uint32](doc:field-types#uint32)<br>The duration, in seconds, this cycle was set to. |
| `remaining_s`: [Uint32](doc:field-types#uint32)<br>The duration, in seconds, remaining in this cycle |
| `last_power`: [BoolInt](doc:field-types#boolint)<br>The power state before the HEV cycle started, which will be the power state once the cycle completes. This is only relevant if remaining\_s is larger than 0. |

### StateHevCycleConfiguration - Packet 147   [Skip link to StateHevCycleConfiguration - Packet 147](https://lan.developer.lifx.com/docs/information-messages\#statehevcycleconfiguration---packet-147)

This packet lets you set default values for a HEV cycle on the device

This packet requires the device has the `hev` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetHevCycleConfiguration (145)](doc:querying-the-device-for-data#gethevcycleconfiguration---packet-145) and [SetHevCycleConfiguration (146)](doc:changing-a-device#sethevcycleconfiguration---packet-146) messages

|  |
| --- |
|  |
| `indication`: [BoolInt](doc:field-types#boolint)<br>Whether a short flashing indication is run at the end of an HEV cycle. |
| `duration_s`: [Uint32](doc:field-types#uint32)<br>This is the default duration that is used when [SetHevCycle (143)](doc:changing-a-device#sethevcycle---packet-143) is given 0 for duration\_s. |

### StateLastHevCycleResult - Packet 149   [Skip link to StateLastHevCycleResult - Packet 149](https://lan.developer.lifx.com/docs/information-messages\#statelasthevcycleresult---packet-149)

This packet tells you the result of the last HEV cycle that was run

This packet requires the device has the `hev` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetLastHevCycleResult (148)](doc:querying-the-device-for-data#getlasthevcycleresult---packet-148) message

|  |
| --- |
|  |
| `result`: [Uint8](doc:field-types#uint8) using [LightLastHevCycleResult](doc:field-types#lightlasthevcycleresult) Enum<br>An enum saying whether the last cycle completed or interrupted. |

# MultiZone   [Skip link to MultiZone](https://lan.developer.lifx.com/docs/information-messages\#multizone)

### StateZone - Packet 503   [Skip link to StateZone - Packet 503](https://lan.developer.lifx.com/docs/information-messages\#statezone---packet-503)

This represents the [HSBK](doc:representing-color-with-hsbk) value of a single zone on your strip.

This packet requires the device has the `Linear Zones` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetColorZones (502)](doc:querying-the-device-for-data#getcolorzones---packet-502) and [SetColorZones (501)](doc:changing-a-device#setcolorzones---packet-501) messages

|  |
| --- |
|  |
| `zones_count`: [Uint8](doc:field-types#uint8)<br>The total number of zones on the strip. |
| `zone_index`: [Uint8](doc:field-types#uint8)<br>The zone this packet refers to. |
| `hue`: [Uint16](doc:field-types#uint16) |
| `saturation`: [Uint16](doc:field-types#uint16) |
| `brightness`: [Uint16](doc:field-types#uint16) |
| `kelvin`: [Uint16](doc:field-types#uint16) |

### StateMultiZone - Packet 506   [Skip link to StateMultiZone - Packet 506](https://lan.developer.lifx.com/docs/information-messages\#statemultizone---packet-506)

This represents a segment of `8` [HSBK](doc:representing-color-with-hsbk) values on your strip.

This packet requires the device has the `Linear Zones` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetColorZones (502)](doc:querying-the-device-for-data#getcolorzones---packet-502) and [SetColorZones (501)](doc:changing-a-device#setcolorzones---packet-501) messages

|  |
| --- |
|  |
| `zones_count`: [Uint8](doc:field-types#uint8)<br>The total number of zones on your strip |
| `zone_index`: [Uint8](doc:field-types#uint8)<br>The first zone represented by this packet |
| `colors`: 8 [Color](doc:field-types#color) structures<br>The [HSBK](doc:representing-color-with-hsbk) values of the zones this packet refers to. |

### StateMultiZoneEffect - Packet 509   [Skip link to StateMultiZoneEffect - Packet 509](https://lan.developer.lifx.com/docs/information-messages\#statemultizoneeffect---packet-509)

This packet tells us what [Firmware Effect](doc:firmware-effects) is current running on the device.

This packet requires the device has the `Linear Zones` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetMultiZoneEffect (507)](doc:querying-the-device-for-data#getmultizoneeffect---packet-507) and [SetMultiZoneEffect (508)](doc:changing-a-device#setmultizoneeffect---packet-508) messages

|  |
| --- |
|  |
| `instanceid`: [Uint32](doc:field-types#uint32)<br>The unique value identifying this effect |
| `type`: [Uint8](doc:field-types#uint8) using [MultiZoneEffectType](doc:field-types#multizoneeffecttype) Enum |
| `reserved6`: 2 [Reserved](doc:field-types#reserved) bytes |
| `speed`: [Uint32](doc:field-types#uint32)<br>The time it takes for one cycle of the effect in milliseconds |
| `duration`: [Uint64](doc:field-types#uint64)<br>The amount of time left in the current effect in nanoseconds |
| `reserved7`: 4 [Reserved](doc:field-types#reserved) bytes |
| `reserved8`: 4 [Reserved](doc:field-types#reserved) bytes |
| `parameters`: 32 [Bytes](doc:field-types#bytes)<br>The parameters that was used in the request. |

### StateExtendedColorZones - Packet 512   [Skip link to StateExtendedColorZones - Packet 512](https://lan.developer.lifx.com/docs/information-messages\#stateextendedcolorzones---packet-512)

The [HSBK](doc:representing-color-with-hsbk) values of the zones specified in the request

This packet requires the device has the `Extended Linear Zones` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetExtendedColorZones (511)](doc:querying-the-device-for-data#getextendedcolorzones---packet-511) and [SetExtendedColorZones (510)](doc:changing-a-device#setextendedcolorzones---packet-510) messages

|  |
| --- |
|  |
| `zones_count`: [Uint16](doc:field-types#uint16)<br>The number of zones on your strip |
| `zone_index`: [Uint16](doc:field-types#uint16)<br>The first zone represented in the packet. If the light has more than 82 zones, then this property indicates the relative positioning of the colors contained in a given message. |
| `colors_count`: [Uint8](doc:field-types#uint8)<br>The number of [HSBK](doc:representing-color-with-hsbk) values in the `colors` array that map to zones. |
| `colors`: 82 [Color](doc:field-types#color) structures<br>The [HSBK](doc:representing-color-with-hsbk) values currently set on each zone. |

# Relay   [Skip link to Relay](https://lan.developer.lifx.com/docs/information-messages\#relay)

### StateRPower - Packet 818   [Skip link to StateRPower - Packet 818](https://lan.developer.lifx.com/docs/information-messages\#staterpower---packet-818)

Current models of the LIFX switch do not have dimming capability, so the two valid values are `0` for `off` and `65535` for `on`.

This packet requires the device has the `Relays` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetRPower (816)](doc:querying-the-device-for-data#getrpower---packet-816) and [SetRPower (817)](doc:changing-a-device#setrpower---packet-817) messages

|  |
| --- |
|  |
| `relay_index`: [Uint8](doc:field-types#uint8)<br>The relay on the switch starting from `0`. |
| `level`: [Uint16](doc:field-types#uint16)<br>The new value of the relay |

# Tile   [Skip link to Tile](https://lan.developer.lifx.com/docs/information-messages\#tile)

### StateDeviceChain - Packet 702   [Skip link to StateDeviceChain - Packet 702](https://lan.developer.lifx.com/docs/information-messages\#statedevicechain---packet-702)

Information about each device in the chain.

This packet requires the device has the `Matrix Zones` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetDeviceChain (701)](doc:querying-the-device-for-data#getdevicechain---packet-701) message

|  |
| --- |
|  |
| `start_index`: [Uint8](doc:field-types#uint8)<br>The index of the first device in the chain this packet refers to |
| `tile_devices`: 16 [Tile](doc:field-types#tile) structures<br>The information for each device in the chain |
| `tile_devices_count`: [Uint8](doc:field-types#uint8)<br>The number of device in `tile_devices` that map to devices in the chain. |

### State64 - Packet 711   [Skip link to State64 - Packet 711](https://lan.developer.lifx.com/docs/information-messages\#state64---packet-711)

The current [HSBK](doc:representing-color-with-hsbk) values of the zones in a single device.

This packet requires the device has the `Matrix Zones` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [Get64 (707)](doc:querying-the-device-for-data#get64---packet-707) and [Set64 (715)](doc:changing-a-device#set64---packet-715) messages

|  |
| --- |
|  |
| `tile_index`: [Uint8](doc:field-types#uint8)<br>The index of the device in the chain this packet refers to. This is `0` based starting from the device closest to the controller. |
| `reserved6`: 1 [Reserved](doc:field-types#reserved) bytes |
| `x`: [Uint8](doc:field-types#uint8)<br>The x coordinate the colors start from |
| `y`: [Uint8](doc:field-types#uint8)<br>The y coordinate the colors start from |
| `width`: [Uint8](doc:field-types#uint8)<br>The width of each row |
| `colors`: 64 [Color](doc:field-types#color) structures |

### StateTileEffect - Packet 720   [Skip link to StateTileEffect - Packet 720](https://lan.developer.lifx.com/docs/information-messages\#statetileeffect---packet-720)

The current [Firmware Effect](doc:firmware-effects) running on the device

This packet requires the device has the `Matrix Zones` capability. You may use [GetVersion (32)](doc:querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](doc:querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](doc:product-registry) to determine whether your device has this capability

This packet is the reply to the [GetTileEffect (718)](doc:querying-the-device-for-data#gettileeffect---packet-718) and [SetTileEffect (719)](doc:changing-a-device#settileeffect---packet-719) messages

|  |
| --- |
|  |
| `reserved0`: 1 [Reserved](doc:field-types#reserved) bytes |
| `instanceid`: [Uint32](doc:field-types#uint32)<br>The unique value identifying the request |
| `type`: [Uint8](doc:field-types#uint8) using [TileEffectType](doc:field-types#tileeffecttype) Enum |
| `speed`: [Uint32](doc:field-types#uint32)<br>The time it takes for one cycle in milliseconds. |
| `duration`: [Uint64](doc:field-types#uint64)<br>The amount of time left in the current effect in nanoseconds |
| `reserved1`: 4 [Reserved](doc:field-types#reserved) bytes |
| `reserved2`: 4 [Reserved](doc:field-types#reserved) bytes |
| `skyType`: [TileEffectSkyType](doc:field-types#tileeffectskytype) only used on `SKY` effect |
| `reserved3`: 3 [Reserved](doc:field-types#reserved) bytes |
| `cloudSaturationMin` 1 [Bytes](doc:field-types#bytes) only used on `SKY` effect when using `CLOUDS` |
| `reserved4`: 3 [Reserved](doc:field-types#reserved) bytes |
| `cloudSaturationMax` 1 [Bytes](doc:field-types#bytes) only used on `SKY` effect when using `CLOUDS` (recommended default is 180) |
| `reserved5`: 23 [Reserved](doc:field-types#reserved) bytes<br>This field is currently ignored by all firmware effects. |
| `palette_count`: [Uint8](doc:field-types#uint8)<br>The number of colors in the `palette` that are relevant |
| `palette`: 16 [Color](doc:field-types#color) structures<br>The colors specified for the effect. |

### SensorStateAmbientLight - Packet 402   [Skip link to SensorStateAmbientLight - Packet 402](https://lan.developer.lifx.com/docs/information-messages\#sensorstateambientlight---packet-402)

\*\*Note: This feature is experimental and potentially subject to change. \*\*

This feature is only supported by a limited number of devices.

This packet shows the current levels of ambient light as detected by the target device, and is emitted by a device in response to a `[SensorGetAmbientLight (401)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#sensorgetambientlight---packet-401)` message.

|  |
| --- |
| `lux`: [Float](doc:field-types#uint8)<br>The value of the detected light level. If a light is turned on at the time the message is sent, the value will be unreliable and potentially maxed out. For best results, only send this message to devices that are currently "soft off". |

Updatedabout 2 months ago

* * *