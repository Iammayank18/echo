import Cocoa

// Native helper that detects macOS Fn (Globe) key press/release.
// The Fn key generates NSEvent.flagsChanged with .function modifier —
// NOT keyDown/keyUp. Only native Cocoa code can detect this.
//
// CRITICAL: NSApplication.shared is required. Without it, the process
// has no connection to the macOS window server and addGlobalMonitorForEvents
// silently receives zero events.

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // No dock icon

var fnDown = false

NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged) { event in
    let fn = event.modifierFlags.contains(.function)
    if fn && !fnDown {
        fnDown = true
        print("down")
        fflush(stdout)
    } else if !fn && fnDown {
        fnDown = false
        print("up")
        fflush(stdout)
    }
}

print("ready")
fflush(stdout)

app.run()
