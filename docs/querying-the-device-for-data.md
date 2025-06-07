The LIFX protocol supplies a number of `Get` messages for getting information from the LIFX devices. When you send these messages to the device with the `res_required` flag set to `0` you will get one or more `State` messages in response.

Below you will find the `type` of the message, the fields that make up the payload of the message, the information you get from the request, and how many `State` messages you should expect in response.

Note that unless specified these packets have an empty payload.

# Discovery   [Skip link to Discovery](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#discovery)

### GetService - Packet 2   [Skip link to GetService - Packet 2](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getservice---packet-2)

This packet is used for Discovery of devices. Typically you would broadcast this message to the network (with `tagged` field in the header set to `0` and the `target` field in the header set to all zeros)

Each device on the network that receives this packet will send back multiple [StateService (3)](https://lan.developer.lifx.com/docs/information-messages#stateservice---packet-3) messages that say what services are available and the port those services are on.

The only [StateService (3)](https://lan.developer.lifx.com/docs/information-messages#stateservice---packet-3) message you care about will tell you that `UDP` is available on a port that is usually `56700`. You can determine the `IP` address of the device from information your `UDP` socket should receive when it gets those bytes.

# Device   [Skip link to Device](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#device)

### GetHostFirmware - Packet 14   [Skip link to GetHostFirmware - Packet 14](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#gethostfirmware---packet-14)

This is used to determine the version of the firmware you have on your device. Typically you would use this information to determine the capabilities of your device as specified in our [Product Registry](https://lan.developer.lifx.com/docs/product-registry).

Will return one [StateHostFirmware (15)](https://lan.developer.lifx.com/docs/information-messages#statehostfirmware---packet-15) message

### GetWifiInfo - Packet 16   [Skip link to GetWifiInfo - Packet 16](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getwifiinfo---packet-16)

This packet is used to determine the signal strength of the device.

Will return one [StateWifiInfo (17)](https://lan.developer.lifx.com/docs/information-messages#statewifiinfo---packet-17) message

### GetWifiFirmware - Packet 18   [Skip link to GetWifiFirmware - Packet 18](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getwififirmware---packet-18)

Our first and second generation devices have separate wifi firmware to the host firmware. For these devices, this message will return the version of the wifi firmware on the device. This message can be used to determine the version of this firmware.

Will return one [StateWifiFirmware (19)](https://lan.developer.lifx.com/docs/information-messages#statewififirmware---packet-19) message

### GetPower - Packet 20   [Skip link to GetPower - Packet 20](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getpower---packet-20)

This packet can be used to determine the power level of the device.

Will return one [StatePower (22)](https://lan.developer.lifx.com/docs/information-messages#statepower---packet-22) message

### GetLabel - Packet 23   [Skip link to GetLabel - Packet 23](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getlabel---packet-23)

This packet can be used to determine the label set on the device.

Will return one [StateLabel (25)](https://lan.developer.lifx.com/docs/information-messages#statelabel---packet-25) message

### GetVersion - Packet 32   [Skip link to GetVersion - Packet 32](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getversion---packet-32)

This packet can be used to determine the product type of the device.

Typically this information is used to determine what capabilities the device has as defined by our [Product Registry](https://lan.developer.lifx.com/docs/product-registry).

Will return one [StateVersion (33)](https://lan.developer.lifx.com/docs/information-messages#stateversion---packet-33) message

### GetInfo - Packet 34   [Skip link to GetInfo - Packet 34](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getinfo---packet-34)

This can be used to determine the uptime and downtime of the device. As well as the current time according to the device.

Will return one [StateInfo (35)](https://lan.developer.lifx.com/docs/information-messages#stateinfo---packet-35) message

### GetLocation - Packet 48   [Skip link to GetLocation - Packet 48](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getlocation---packet-48)

This packet can be used to determine the uuid and label of the location assigned to this device.

Will return one [StateLocation (50)](https://lan.developer.lifx.com/docs/information-messages#statelocation---packet-50) message

### GetGroup - Packet 51   [Skip link to GetGroup - Packet 51](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getgroup---packet-51)

This packet can be used to determine the uuid and label of the group assigned to this device.

Will return one [StateGroup (53)](https://lan.developer.lifx.com/docs/information-messages#stategroup---packet-53) message

### EchoRequest - Packet 58   [Skip link to EchoRequest - Packet 58](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#echorequest---packet-58)

This packet can be used to check that a device is online and responding to you.

Will return one [EchoResponse (59)](https://lan.developer.lifx.com/docs/information-messages#echoresponse---packet-59) message

|  |
| --- |
|  |
| `echoing`: 64 [Bytes](doc:field-types#bytes)<br>The bytes you want to receive in the [EchoResponse (59)](doc:information-messages#echoresponse---packet-59) message. |

# Light   [Skip link to Light](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#light)

### GetColor - Packet 101   [Skip link to GetColor - Packet 101](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getcolor---packet-101)

This packet is used to get the current visual state of the device.

Will return one [LightState (107)](https://lan.developer.lifx.com/docs/information-messages#lightstate---packet-107) message

### GetLightPower - Packet 116   [Skip link to GetLightPower - Packet 116](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getlightpower---packet-116)

Like [GetPower (20)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getpower---packet-20) this packet will return the current power level of the device.

Will return one [StateLightPower (118)](https://lan.developer.lifx.com/docs/information-messages#statelightpower---packet-118) message

### GetInfrared - Packet 120   [Skip link to GetInfrared - Packet 120](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getinfrared---packet-120)

This packet is used to determine the current infrared level of the device.

Will return one [StateInfrared (121)](https://lan.developer.lifx.com/docs/information-messages#stateinfrared---packet-121) message

This packet requires the device has the `infrared` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

### GetHevCycle - Packet 142   [Skip link to GetHevCycle - Packet 142](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#gethevcycle---packet-142)

This packet is used to determine the state of the HEV LEDs on the device

Will return one [StateHevCycle (144)](https://lan.developer.lifx.com/docs/information-messages#statehevcycle---packet-144) message

This packet requires the device has the `hev` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

### GetHevCycleConfiguration - Packet 145   [Skip link to GetHevCycleConfiguration - Packet 145](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#gethevcycleconfiguration---packet-145)

This packet is used to determine the default configuration for using the HEV LEDs on the device.

Will return one [StateHevCycleConfiguration (147)](https://lan.developer.lifx.com/docs/information-messages#statehevcycleconfiguration---packet-147) message

This packet requires the device has the `hev` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

### GetLastHevCycleResult - Packet 148   [Skip link to GetLastHevCycleResult - Packet 148](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getlasthevcycleresult---packet-148)

This packet is used to determine the result of the last HEV cycle that was run

Will return one [StateLastHevCycleResult (149)](https://lan.developer.lifx.com/docs/information-messages#statelasthevcycleresult---packet-149) message

This packet requires the device has the `hev` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

# MultiZone   [Skip link to MultiZone](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#multizone)

### GetColorZones - Packet 502   [Skip link to GetColorZones - Packet 502](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getcolorzones---packet-502)

There are two possible messages that this request may return. If the number of zones in the response is just one then you will get a single [StateZone (503)](https://lan.developer.lifx.com/docs/information-messages#statezone---packet-503). Otherwise you will get one or more [StateMultiZone (506)](https://lan.developer.lifx.com/docs/information-messages#statemultizone---packet-506) replies.

You can determine how many StateMultizone messages you will receive by looking at the request and the first reply.

Some pseudo code would look like this:

```rdmd-code lang-undefined theme-light
number_segments_of_8 = (request.end_index - request.start_index) / 8
count_from_request = maximum(1, floor(number_segements_of_8) + 1)

count_from_response = ceil(first_response.zone_count / 8)

expected_number_of_messages = minimum(count_from_request, count_from_response)
```

Note that if you want all the zones to be returned to you, you should set `start_index` to `0` and `end_index` to `255`

This packet requires the device has the `Linear Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `start_index`: [Uint8](doc:field-types#uint8)<br>The first zone you want to get information from |
| `end_index`: [Uint8](doc:field-types#uint8)<br>The second zone you want to get information from |

### GetMultiZoneEffect - Packet 507   [Skip link to GetMultiZoneEffect - Packet 507](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getmultizoneeffect---packet-507)

This packet can be used to determine if the device is currently running a multizone [Firmware Effect](https://lan.developer.lifx.com/docs/firmware-effects).

Will return one [StateMultiZoneEffect (509)](https://lan.developer.lifx.com/docs/information-messages#statemultizoneeffect---packet-509) message

This packet requires the device has the `Linear Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

### GetExtendedColorZones - Packet 511   [Skip link to GetExtendedColorZones - Packet 511](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getextendedcolorzones---packet-511)

This packet can be used to get response packets containing the [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) values for every zone on your strip.

Will return [StateExtendedColorZones (512)](https://lan.developer.lifx.com/docs/information-messages#stateextendedcolorzones---packet-512) messages. If the light has more than 82 zones, then multiple responses shall be returned with different `zone_index` values. The value of the `zone_count` property shall indicate the total number of zones on the device.

This packet requires the device has the `Extended Linear Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

# Relay   [Skip link to Relay](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#relay)

### GetRPower - Packet 816   [Skip link to GetRPower - Packet 816](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getrpower---packet-816)

Get the power state of a relay on a switch device.

Will return one [StateRPower (818)](https://lan.developer.lifx.com/docs/information-messages#staterpower---packet-818) message

This packet requires the device has the `Relays` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `relay_index`: [Uint8](doc:field-types#uint8)<br>The relay on the switch starting from `0`. |

# Tile   [Skip link to Tile](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#tile)

### GetDeviceChain - Packet 701   [Skip link to GetDeviceChain - Packet 701](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#getdevicechain---packet-701)

This packet can be used to get information about all the devices in the chain. Note that for LIFX Tiles this will only ever be up to `5` devices and for the LIFX Candle it will only be `1` device.

Will return one [StateDeviceChain (702)](https://lan.developer.lifx.com/docs/information-messages#statedevicechain---packet-702) message

This packet requires the device has the `Matrix Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

### Get64 - Packet 707   [Skip link to Get64 - Packet 707](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#get64---packet-707)

Used to get the [HSBK](https://lan.developer.lifx.com/docs/representing-color-with-hsbk) values of all the zones in devices connected in the chain.

this will return one or more [State64 (711)](https://lan.developer.lifx.com/docs/information-messages#state64---packet-711) messages. The maximum number of messages you will receive is the number specified by `length` in your request.

This packet requires the device has the `Matrix Zones` capability. You may use [GetVersion (32)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#getversion---packet-32), [GetHostFirmware (14)](https://lan.developer.lifx.com/docs/querying-the-device-for-data#gethostfirmware---packet-14) and the [Product Registry](https://lan.developer.lifx.com/docs/product-registry) to determine whether your device has this capability

|  |
| --- |
|  |
| `tile_index`: [Uint8](doc:field-types#uint8)<br>The first item in the chain you want zones |
| `length`: [Uint8](doc:field-types#uint8)<br>The number of tiles after `tile_index` you want [HSBK](doc:representing-color-with-hsbk) values from. |
| `reserved6`: 1 [Reserved](doc:field-types#reserved) bytes |
| `x`: [Uint8](doc:field-types#uint8)<br>The x value to start from. You likely always want this to be `0`. |
| `y`: [Uint8](doc:field-types#uint8)<br>The y value to start from. You likely always want this to be `0`. |
| `width`: [Uint8](doc:field-types#uint8)<br>The width of each item in the chain. For the LIFX Tile you want this to be `8` and for the LIFX Candle you want this to be `5`. |

### GetTileEffect - Packet 718   [Skip link to GetTileEffect - Packet 718](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#gettileeffect---packet-718)

Used to determine if the device is running a [Firmware Effect](https://lan.developer.lifx.com/docs/firmware-effects).

Will return one [StateTileEffect (720)](https://lan.developer.lifx.com/docs/information-messages#statetileeffect---packet-720) message

|  |
| --- |
|  |
| `reserved6`: 1 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |
| `reserved7`: 1 [Reserved](https://lan.developer.lifx.com/docs/field-types#reserved) bytes |

### SensorGetAmbientLight - Packet 401   [Skip link to SensorGetAmbientLight - Packet 401](https://lan.developer.lifx.com/docs/querying-the-device-for-data\#sensorgetambientlight---packet-401)

Used to get the current ambient light level from a device. Device will return a [SensorStateAmbientLight (402)](https://lan.developer.lifx.com/docs/information-messages#sensorstateambientlight---packet-402) message.

Updatedabout 2 months ago

* * *