// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "GroovectlHelper", platforms: [.macOS(.v13)],
    products: [.executable(name: "GroovectlHelper", targets: ["GroovectlHelper"])],
    targets: [
        .target(name: "MusicBridge", resources: [.copy("music.js")]),
        .executableTarget(name: "GroovectlHelper", dependencies: ["MusicBridge"]),
        .testTarget(name: "MusicBridgeTests", dependencies: ["MusicBridge"]),
    ]
)
