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

final class Controller: NSObject, NSApplicationDelegate, NSMenuDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let secret = loadSecret()
    var timer: Timer?
    var fullText = "—"
    var lastPayload = ""
    var lastTitle = ""
    var lastAllDone = false
    var textHidden = UserDefaults.standard.bool(forKey: "textHidden")
    var lastCounts = (remaining: 0, total: 0)

    func applicationDidFinishLaunching(_ notification: Notification) {
        applyTitle()
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

    // 10 minute, nu secunde: fiecare request ține Neon-ul (free, compute limitat)
    // treaz. Refresh imediat există la: deschiderea meniului, Done, wake, manual.
    func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 600, repeats: true) { [weak self] _ in self?.refresh() }
    }

    func menuWillOpen(_ menu: NSMenu) {
        refresh()
    }

    func buildMenu(remaining: Int, total: Int) {
        let menu = NSMenu()
        menu.autoenablesItems = false
        let head = NSMenuItem(title: fullText, action: nil, keyEquivalent: "")
        head.isEnabled = false
        menu.addItem(head)
        if total > 0 {
            let count = NSMenuItem(title: "\(total - remaining)/\(total) bifate azi", action: nil, keyEquivalent: "")
            count.isEnabled = false
            menu.addItem(count)
        }
        menu.addItem(.separator())
        let doneItem = NSMenuItem(title: "Done", action: #selector(markDone), keyEquivalent: "d")
        doneItem.isEnabled = remaining > 0
        menu.addItem(doneItem)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: textHidden ? "Arată textul" : "Ascunde textul",
                                action: #selector(toggleText), keyEquivalent: "h"))
        menu.addItem(NSMenuItem(title: "Deschide Elite Deux", action: #selector(open), keyEquivalent: "o"))
        menu.addItem(NSMenuItem(title: "Reîmprospătează", action: #selector(reload), keyEquivalent: "r"))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Ieși", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        for i in menu.items where i.action != nil { i.target = i.action == #selector(NSApplication.terminate(_:)) ? nil : self }
        menu.delegate = self
        item.menu = menu
    }

    @objc func open() {
        if let url = URL(string: baseURL + "/elite-deux") { NSWorkspace.shared.open(url) }
    }

    @objc func reload() { refresh() }

    @objc func markDone() {
        guard var req = URL(string: baseURL + "/api/elite-deux/next").map({ URLRequest(url: $0) }) else { return }
        req.httpMethod = "POST"
        req.setValue(secret, forHTTPHeaderField: "x-elite-secret")
        req.timeoutInterval = 15
        URLSession.shared.dataTask(with: req) { [weak self] _, _, _ in
            DispatchQueue.main.async { self?.refresh() }
        }.resume()
    }

    @objc func toggleText() {
        textHidden.toggle()
        UserDefaults.standard.set(textHidden, forKey: "textHidden")
        applyTitle()
        buildMenu(remaining: lastCounts.remaining, total: lastCounts.total)
    }

    func setTitle(_ text: String, allDone: Bool = false) {
        lastTitle = text
        lastAllDone = allDone
        applyTitle()
    }

    func applyTitle() {
        let text = textHidden
            ? ""
            : (lastTitle.count > 42 ? String(lastTitle.prefix(41)) + "…" : lastTitle)
        let color = lastAllDone
            ? NSColor(red: 0x1d / 255, green: 0xa1 / 255, blue: 0x5c / 255, alpha: 1)
            : NSColor(red: 0xd9 / 255, green: 0x1f / 255, blue: 0x7f / 255, alpha: 1)
        item.button?.title = ""
        item.button?.image = badge(text: text, color: color)
        item.button?.image?.isTemplate = false
    }

    /// Etichetă colorată cu bifă + text (verde când e totul bifat), ca să sară în ochi în topbar.
    func badge(text: String, color: NSColor) -> NSImage {
        let font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.white]
        let check = "✓"
        let label = text.isEmpty ? check : "\(check)  \(text)"
        let size = (label as NSString).size(withAttributes: attrs)

        let padX: CGFloat = 8
        let height: CGFloat = 18
        let width = ceil(size.width) + padX * 2

        let image = NSImage(size: NSSize(width: width, height: height))
        image.lockFocus()
        let rect = NSRect(x: 0, y: 0, width: width, height: height)
        color.setFill()
        NSBezierPath(roundedRect: rect, xRadius: 5, yRadius: 5).fill()
        (label as NSString).draw(
            at: NSPoint(x: padX, y: (height - size.height) / 2),
            withAttributes: attrs
        )
        image.unlockFocus()
        return image
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
            var allDone = false
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
                    allDone = total > 0
                    title = allDone ? "Gata pe azi" : "Niciun task azi"
                    full = title
                }
            }
            let payload = "\(title)|\(full)|\(remaining)/\(total)|\(allDone)"
            DispatchQueue.main.async {
                guard payload != self.lastPayload else { return }
                self.lastPayload = payload
                self.lastCounts = (remaining, total)
                self.fullText = full
                self.setTitle(title, allDone: allDone)
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
