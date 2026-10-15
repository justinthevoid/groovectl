import Foundation
import AppKit
import OSAKit

public enum BridgeError: Error, LocalizedError {
    case invalid(String)
    public var errorDescription: String? { if case let .invalid(message) = self { return message }; return nil }
}

public enum MusicBridge {
    public static func scriptURL() throws -> URL {
        if let url = Bundle.main.url(forResource: "music", withExtension: "js") { return url }
        guard let url = Bundle.module.url(forResource: "music", withExtension: "js") else { throw BridgeError.invalid("Bundled Music operations are missing.") }
        return url
    }
    public static func persistentID(_ value: String) throws -> String {
        guard value.range(of: "^[0-9A-Fa-f]{16}$", options: .regularExpression) != nil else {
            throw BridgeError.invalid("A Music.app persistent ID (16 hex digits) is required.")
        }
        return value.uppercased()
    }
    public static func quoted(_ value: String) -> String {
        "\"" + value.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\n", with: "\\n") + "\""
    }
    @MainActor private static func appleScript(_ source: String) throws -> String {
        guard let script = NSAppleScript(source: "with timeout of 40 seconds\n" + source + "\nend timeout") else {
            throw BridgeError.invalid("Could not initialize the fixed Music operation.")
        }
        var error: NSDictionary?
        let result = script.executeAndReturnError(&error)
        guard error == nil else {
            throw BridgeError.invalid("Music automation failed. Allow Groovectl Helper in System Settings > Privacy & Security > Automation. Error code: \(error?[NSAppleScript.errorNumber] ?? "unknown").")
        }
        return result.stringValue ?? ""
    }
    static func readProgram(source: String, request: [String: Any]) throws -> String {
        let payload = String(decoding: try JSONSerialization.data(withJSONObject: request, options: [.sortedKeys]), as: UTF8.self)
        // The argument is a JSON-encoded string literal, never source supplied by a caller.
        let argument = String(decoding: try JSONSerialization.data(withJSONObject: [payload]), as: UTF8.self)
        // Keep `run` out of the global script scope. OSA otherwise invokes that
        // handler a second time with its own empty argument list.
        return "(() => {\n" + source + "\nreturn run(" + argument + ");\n})()"
    }
    @MainActor private static func read(_ request: [String: Any]) throws -> [String: Any] {
        let source = try String(contentsOf: scriptURL(), encoding: .utf8)
        let script = OSAScript(source: try readProgram(source: source, request: request), language: OSALanguage(forName: "JavaScript"))
        var error: NSDictionary?
        let reply = script.executeAndReturnError(&error)
        guard error == nil else {
            throw BridgeError.invalid("Music read failed. Check Groovectl Helper's Automation permission if macOS denied access. Error code: \(error?[NSAppleScript.errorNumber] ?? "unknown").")
        }
        guard let text = reply?.stringValue, let data = text.data(using: .utf8),
              let result = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw BridgeError.invalid("Music returned an invalid read response.")
        }
        if let message = result["error"] as? String { throw BridgeError.invalid(message) }
        return result
    }
    @MainActor public static func execute(_ input: Data) throws -> [String: Any] {
        guard input.count <= 1_048_576, let request = try JSONSerialization.jsonObject(with: input) as? [String: Any], let op = request["op"] as? String else { throw BridgeError.invalid("Invalid helper request.") }
        if op == "ping" { return ["name": "Groovectl Helper", "version": "0.2.0", "protocol_version": 1, "bundle_id": Bundle.main.bundleIdentifier ?? "source-build", "resource_source": Bundle.main.url(forResource: "music", withExtension: "js") == nil ? "swiftpm" : "app", "scripts_available": FileManager.default.fileExists(atPath: try scriptURL().path)] }
        if ["status", "playlists", "playlist", "tracks", "search"].contains(op) {
            var checked: [String: Any] = ["op": op]
            if op == "playlist" { checked["id"] = try persistentID(request["id"] as? String ?? "") }
            if op == "tracks" {
                guard let ids = request["ids"] as? [String], (1...200).contains(ids.count) else { throw BridgeError.invalid("Resolve 1–200 native track IDs.") }
                checked["ids"] = try ids.map(persistentID)
            }
            if op == "search" {
                let query = request["query"] as? String ?? "", limit = request["limit"] as? Int ?? 30, offset = request["offset"] as? Int ?? 0
                guard query.count <= 200, (1...100).contains(limit), (0...100000).contains(offset) else { throw BridgeError.invalid("Invalid search bounds.") }
                checked.merge(["query": query, "limit": limit, "offset": offset]) { _, value in value }
            }
            return try read(checked)
        }
        if op == "create" || op == "append" {
            guard let ids = request["ids"] as? [String], (1...200).contains(ids.count) else { throw BridgeError.invalid("Write 1–200 resolved tracks.") }
            let checked = try ids.map(persistentID)
            let name = request["name"] as? String ?? ""
            guard name.count <= 120, op != "create" || !name.isEmpty else { throw BridgeError.invalid("Invalid playlist name.") }
            let resolve = checked.enumerated().map { "set t\($0.offset) to first track of library playlist 1 whose persistent ID is \(quoted($0.element))" }.joined(separator: "\n")
            let target = op == "create" ? "set p to make new user playlist with properties {name:\(quoted(name))}" : "set p to first user playlist whose persistent ID is \(quoted(try persistentID(request["id"] as? String ?? "")))"
            // Return the new ID before additions so the TypeScript journal owns
            // the empty playlist even if a subsequent add fails or times out.
            let adds = op == "append" ? checked.indices.map { "duplicate t\($0) to p" }.joined(separator: "\n") : ""
            let id = try appleScript("tell application \"Music\"\n\(resolve)\n\(target)\n\(adds)\nreturn persistent ID of p\nend tell")
            return ["id": try persistentID(id)]
        }
        if op == "delete_owned" {
            let id = try persistentID(request["id"] as? String ?? ""), name = request["name"] as? String ?? ""
            guard !name.isEmpty, name.count <= 120 else { throw BridgeError.invalid("Expected playlist name is required.") }
            _ = try appleScript("tell application \"Music\"\nset p to first user playlist whose persistent ID is \(quoted(id))\nif name of p is not \(quoted(name)) then error \"Playlist name changed; refusing deletion\"\ndelete p\nend tell")
            return ["deleted": true]
        }
        if op == "playback" {
            let action = request["action"] as? String ?? "", number = request["value"] as? Double
            let track = request["track_id"] as? String, playlist = request["playlist_id"] as? String
            guard track == nil || playlist == nil, action == "play" || (track == nil && playlist == nil) else { throw BridgeError.invalid("Invalid playback target.") }
            var command: String
            switch action {
            case "play":
                if let id = track ?? playlist { command = "play (first \(playlist != nil ? "user playlist" : "track of library playlist 1") whose persistent ID is \(quoted(try persistentID(id))))" }
                else { command = "play" }
            case "pause", "stop": command = action
            case "next": command = "next track"
            case "previous": command = "previous track"
            case "volume": guard let value = number, value.isFinite, value.rounded() == value, (0...100).contains(value) else { throw BridgeError.invalid("Volume must be an integer from 0 to 100.") }; command = "set sound volume to \(Int(value))"
            case "seek": guard let value = number, value.isFinite, (0...86400).contains(value) else { throw BridgeError.invalid("Seek position must be between 0 and 86400 seconds.") }; command = "set player position to \(value)"
            case "shuffle": guard number == 0 || number == 1 else { throw BridgeError.invalid("Shuffle must be 0 or 1.") }; command = "set shuffle enabled to \(number == 1 ? "true" : "false")"
            case "repeat": guard let value = number, [0.0, 1.0, 2.0].contains(value) else { throw BridgeError.invalid("Invalid repeat mode.") }; command = "set song repeat to \(["off", "one", "all"][Int(value)])"
            default: throw BridgeError.invalid("Unsupported playback action.")
            }
            _ = try appleScript("tell application \"Music\" to \(command)")
            return try read(["op": "status"])
        }
        throw BridgeError.invalid("Unsupported helper operation. Raw scripts and shell commands are not accepted.")
    }
}
