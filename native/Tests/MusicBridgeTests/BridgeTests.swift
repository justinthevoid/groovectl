import Testing
import Foundation
import OSAKit
@testable import MusicBridge

@Test func validatesIDsAndEscapesData() throws {
    #expect(try MusicBridge.persistentID("abcdef0123456789") == "ABCDEF0123456789")
    #expect(throws: BridgeError.self) { try MusicBridge.persistentID("\" & do shell script \"id") }
    #expect(MusicBridge.quoted("a\"\\\nb") == "\"a\\\"\\\\\\nb\"")
}
@Test @MainActor func rejectsRawOperations() {
    #expect(throws: BridgeError.self) { try MusicBridge.execute(Data("{\"op\":\"eval\",\"script\":\"do shell script\"}".utf8)) }
    #expect(throws: BridgeError.self) { try MusicBridge.execute(Data("{\"op\":\"playback\",\"action\":\"volume\",\"value\":101}".utf8)) }
}
@Test func bundledReadOperationsExist() throws {
    let source = try String(contentsOf: MusicBridge.scriptURL(), encoding: .utf8)
    #expect(source.contains("function run(argv)"))
}

@Test @MainActor func fixedReadProgramReceivesOnlyItsExplicitJSONArgument() throws {
    let source = "function run(argv) { return JSON.stringify(JSON.parse(argv[0])); }"
    let request = ["query": "quotes \" and Unicode 日本語"]
    let script = OSAScript(source: try MusicBridge.readProgram(source: source, request: request), language: OSALanguage(forName: "JavaScript"))
    var error: NSDictionary?
    let reply = script.executeAndReturnError(&error)
    #expect(error == nil)
    let data = try #require(reply?.stringValue?.data(using: .utf8))
    let result = try JSONSerialization.jsonObject(with: data) as? [String: String]
    #expect(result == request)
}
