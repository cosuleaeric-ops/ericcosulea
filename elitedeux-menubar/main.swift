import AppKit

// Elite Deux menu bar: arată primul task nebifat de azi în topbar-ul macOS.

let baseURL = ProcessInfo.processInfo.environment["ELITE_DEUX_URL"] ?? "https://www.ericcosulea.ro"

func loadSecret() -> String {
    if let s = ProcessInfo.processInfo.environment["ELITE_DEUX_SECRET"], !s.isEmpty { return s }
    let path = NSHomeDirectory() + "/.elitedeux-menubar"
    if let raw = try? String(contentsOfFile: path, encoding: .utf8) {
        return raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return ""
}

final class Controller: NSObject, NSApplicationDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let secret = loadSecret()
    var timer: Timer?
    var fullText = "—"
    var lastPayload = ""

    func applicationDidFinishLaunching(_ notification: Notification) {
        item.button?.image = NSImage(systemSymbolName: "checkmark.circle", accessibilityDescription: nil)
        item.button?.imagePosition = .imageLeading
        buildMenu(remaining: 0, total: 0)
        refresh()
        startTimer()

        // Nu interoga serverul cât Mac-ul doarme.
        let nc = NSWorkspace.shared.notificationCenter
        nc.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { [weak self] _ in
            self?.timer?.invalidate()
            self?.timer = nil
        }
        nc.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            self?.refresh()
            self?.startTimer()
        }
    }

    func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in self?.refresh() }
    }

    func buildMenu(remaining: Int, total: Int) {
        let menu = NSMenu()
        let head = NSMenuItem(title: fullText, action: nil, keyEquivalent: "")
        head.isEnabled = false
        menu.addItem(head)
        if total > 0 {
            let count = NSMenuItem(title: "\(total - remaining)/\(total) bifate azi", action: nil, keyEquivalent: "")
            count.isEnabled = false
            menu.addItem(count)
        }
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Deschide Elite Deux", action: #selector(open), keyEquivalent: "o"))
        menu.addItem(NSMenuItem(title: "Reîmprospătează", action: #selector(reload), keyEquivalent: "r"))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Ieși", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        for i in menu.items where i.action != nil { i.target = i.action == #selector(NSApplication.terminate(_:)) ? nil : self }
        item.menu = menu
    }

    @objc func open() {
        if let url = URL(string: baseURL + "/elite-deux") { NSWorkspace.shared.open(url) }
    }

    @objc func reload() { refresh() }

    func setTitle(_ text: String) {
        let trimmed = text.count > 42 ? String(text.prefix(41)) + "…" : text
        item.button?.title = " " + trimmed
    }

    func refresh() {
        guard var req = URL(string: baseURL + "/api/elite-deux/next").map({ URLRequest(url: $0) }) else { return }
        req.setValue(secret, forHTTPHeaderField: "x-elite-secret")
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.timeoutInterval = 15
        URLSession.shared.dataTask(with: req) { [weak self] data, response, _ in
            guard let self else { return }
            var title = "Elite Deux ?"
            var full = "Nu am putut citi lista"
            var remaining = 0, total = 0
            if let http = response as? HTTPURLResponse, http.statusCode == 401 {
                title = "Elite Deux: secret invalid"
                full = "Verifică ~/.elitedeux-menubar"
            } else if let data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                remaining = json["remaining"] as? Int ?? 0
                total = json["total"] as? Int ?? 0
                if let text = json["text"] as? String {
                    title = text
                    full = text
                } else {
                    title = total > 0 ? "Toate bifate ✓" : "Niciun task azi"
                    full = title
                }
            }
            let payload = "\(title)|\(full)|\(remaining)/\(total)"
            DispatchQueue.main.async {
                guard payload != self.lastPayload else { return }
                self.lastPayload = payload
                self.fullText = full
                self.setTitle(title)
                self.buildMenu(remaining: remaining, total: total)
            }
        }.resume()
    }
}

let app = NSApplication.shared
let controller = Controller()
app.delegate = controller
app.setActivationPolicy(.accessory)
app.run()
