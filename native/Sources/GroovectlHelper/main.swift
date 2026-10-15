import Foundation
import AppKit
import Darwin
import MusicBridge

@MainActor final class Delegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        DispatchQueue.global(qos: .userInitiated).async { serve() }
    }
}

func sendReply(_ data: Data, to fd: Int32) {
    (data + Data([10])).withUnsafeBytes { buffer in
        guard let base = buffer.baseAddress else { return }
        var offset = 0
        while offset < buffer.count {
            let sent = Darwin.write(fd, base.advanced(by: offset), buffer.count - offset)
            if sent <= 0 { break }; offset += sent
        }
    }
    close(fd)
}

func serve() {
    let root = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Groovectl/run")
    do { try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700]) }
    catch { exit(1) }
    chmod(root.path, 0o700)
    let path = root.appendingPathComponent("helper.sock").path
    guard path.utf8.count < 104 else { exit(1) }
    // One host owns the socket. LaunchServices normally reuses the running app.
    let lock = open(root.appendingPathComponent("helper.lock").path, O_CREAT | O_RDWR, 0o600)
    guard lock >= 0, flock(lock, LOCK_EX | LOCK_NB) == 0 else { exit(0) }
    let listener = socket(AF_UNIX, SOCK_STREAM, 0)
    guard listener >= 0 else { exit(1) }
    unlink(path)
    var address = sockaddr_un(); address.sun_family = sa_family_t(AF_UNIX)
    withUnsafeMutablePointer(to: &address.sun_path) { pointer in
        pointer.withMemoryRebound(to: CChar.self, capacity: 104) { _ = strlcpy($0, path, 104) }
    }
    let bound = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(listener, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) }
    }
    guard bound == 0, chmod(path, 0o600) == 0, listen(listener, 8) == 0 else { exit(1) }
    signal(SIGPIPE, SIG_IGN)
    while true {
        let client = accept(listener, nil, nil)
        if client < 0 { continue }
        var uid: uid_t = 0, gid: gid_t = 0
        guard getpeereid(client, &uid, &gid) == 0, uid == getuid() else { close(client); continue }
        DispatchQueue.global(qos: .userInitiated).async {
            var timeout = timeval(tv_sec: 5, tv_usec: 0)
            _ = setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
            _ = setsockopt(client, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
            var input = Data(), bytes = [UInt8](repeating: 0, count: 8192)
            while input.count <= 1_048_576 {
                let capacity = bytes.count
                let count = Darwin.read(client, &bytes, capacity)
                if count <= 0 { close(client); return }
                input.append(contentsOf: bytes.prefix(count))
                if let end = input.firstIndex(of: 10) {
                    let request = Data(input.prefix(upTo: end))
                    DispatchQueue.main.async {
                        let result: [String: Any]
                        do { result = ["result": try MusicBridge.execute(request)] }
                        catch { result = ["error": error.localizedDescription] }
                        let output = (try? JSONSerialization.data(withJSONObject: result)) ?? Data("{\"error\":\"Helper response failed.\"}".utf8)
                        DispatchQueue.global().async { sendReply(output, to: client) }
                    }
                    return
                }
            }
            close(client)
        }
    }
}

let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
