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
    var lastPinned = false
    var textHidden = UserDefaults.standard.bool(forKey: "textHidden")
    var lastCounts = (remaining: 0, total: 0)

    func applicationDidFinishLaunching(_ notification: Notification) {
        applyTitle()   // pornește ascuns (nimic pinuit) — fără flash de iconiță
        buildMenu(remaining: 0, total: 0)
        refresh()
        startTimer()

        // Iconița e ascunsă cât timp nimic nu e pinuit, deci nu există meniu de
        // deschis ca să detecteze un pin nou → un timer e obligatoriu. Îl oprim
        // cât Mac-ul doarme, ca Neon-ul (free) să adoarmă și el peste noapte;
        // net, DB e trezit doar în orele în care Mac-ul e pornit.
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
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in self?.refresh() }
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
        doneItem.isEnabled = lastPinned
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

    func setTitle(_ text: String) {
        lastTitle = text
        applyTitle()
    }

    func applyTitle() {
        // Nimic pinuit → iconița dispare complet din bara de meniu.
        guard lastPinned, let button = item.button else {
            item.isVisible = false
            return
        }
        item.isVisible = true
        let text = textHidden
            ? ""
            : (lastTitle.count > 42 ? String(lastTitle.prefix(41)) + "…" : lastTitle)
        let color = NSColor(red: 0xd9 / 255, green: 0x1f / 255, blue: 0x7f / 255, alpha: 1)
        button.title = ""
        button.image = badge(text: text, color: color)
        button.image?.isTemplate = false
    }

    /// Etichetă roz cu bifă + text pentru task-ul pinuit — sare în ochi în topbar.
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
            var pinned = false
            if let http = response as? HTTPURLResponse, http.statusCode == 401 {
                title = "Elite Deux: secret invalid"
                full = "Verifică ~/.elitedeux-menubar"
            } else if let data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                remaining = json["remaining"] as? Int ?? 0
                total = json["total"] as? Int ?? 0
                pinned = json["pinned"] as? Bool ?? false
                if pinned, let text = json["text"] as? String {
                    title = text
                    full = text
                } else {
                    // Nimic pinuit → iconița se ascunde (vezi applyTitle).
                    title = ""
                    full = "Nimic în topbar — apasă 📌 pe un task în app"
                }
            }
            let payload = "\(title)|\(full)|\(remaining)/\(total)|\(pinned)"
            DispatchQueue.main.async {
                guard payload != self.lastPayload else { return }
                self.lastPayload = payload
                self.lastCounts = (remaining, total)
                self.lastPinned = pinned
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
