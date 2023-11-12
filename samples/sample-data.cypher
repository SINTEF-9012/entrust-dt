CREATE (device1:Device {name: "Blood Pressure Monitor", type: "Device"})
CREATE (device2:Device {name: "Oximeter", type: "Device"})
CREATE (device3:Device {name: "Temperature Meter", type: "Device"})
CREATE (device4:Device {name: "Glucose Meter", type: "Device"})
CREATE (gateway1:Gateway {
    name: "Gateway 1",
    type: "Gateway",
    identifier: "MAC1",
    publicKey: "public_key_1",
    vpnCertificate: "vpn_certificate_1",
    fixedIP: "192.168.1.1",
    osVersion: "GatewayOSv1",
    connectivity: true,
    appVersion: "Appv1",
    temperature: 35.5,
    cpu: "Intel Core i7",
    memory: "16GB"
})
CREATE (gateway2:Gateway {
    name: "Gateway 2",
    type: "Gateway",
    identifier: "MAC2",
    publicKey: "public_key_2",
    vpnCertificate: "vpn_certificate_2",
    fixedIP: "192.168.1.2",
    osVersion: "GatewayOSv2",
    connectivity: false,
    appVersion: "Appv2",
    temperature: 40.2,
    cpu: "AMD Ryzen 5",
    memory: "8GB"
})
CREATE (platform:Platform {name: "Cloud Platform", type: "Platform"})
CREATE (device1)-[:CONNECTED_TO]->(gateway1)
CREATE (device2)-[:CONNECTED_TO]->(gateway1)
CREATE (device3)-[:CONNECTED_TO]->(gateway1)
CREATE (device4)-[:CONNECTED_TO]->(gateway1)
CREATE (gateway1)-[:CONNECTED_TO]->(gateway2)
CREATE (gateway1)-[:CONNECTED_TO]->(platform)