import AppKit
import Network

// Elite Deux menu bar: arată DOAR task-ul pinuit manual din app.
//
// ZERO acces la DB în fundal: aplicația web trimite pin/unpin printr-un mic
// server local pe 127.0.0.1 (nu prin Neon), deci nimic nu interoghează baza de
// date cât timp stai. Iconița e ascunsă complet cât nu e nimic pinuit.
// Singura atingere de rețea e „Done” — un singur POST la server care marchează
// task-ul complet (acțiune la click, nu polling).

let baseURL = ProcessInfo.processInfo.environment["ELITE_DEUX_URL"] ?? "https://www.ericcosulea.ro"
let pinPort: UInt16 = 17872

func loadSecret() -> String {
    if let s = ProcessInfo.processInfo.environment["ELITE_DEUX_SECRET"], !s.isEmpty { return s }
    let path = NSHomeDirectory() + "/.elitedeux-menubar"
    if let raw = try? String(contentsOfFile: path, encoding: .utf8) {
        return raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return ""
}

// ── Server local: primește pin/unpin de la app-ul web pe loopback ──
final class PinServer {
    private var listener: NWListener?
    let onMessage: (_ path: String, _ id: String?, _ text: String?) -> Void

    init(onMessage: @escaping (String, String?, String?) -> Void) { self.onMessage = onMessage }

    func start() {
        let params = NWParameters.tcp
        params.requiredInterfaceType = .loopback // doar 127.0.0.1, niciodată din rețea
        params.allowLocalEndpointReuse = true
        guard let port = NWEndpoint.Port(rawValue: pinPort),
              let l = try? NWListener(using: params, on: port) else {
            NSLog("EliteDeux: nu am putut deschide portul \(pinPort)")
            return
        }
        listener = l
        l.newConnectionHandler = { [weak self] c in self?.accept(c) }
        l.start(queue: .main)
    }

    private func accept(_ conn: NWConnection) {
        conn.start(queue: .main)
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, _ in
            guard let self else { conn.cancel(); return }
            if let data, let req = String(data: data, encoding: .utf8) {
                let firstLine = req.components(separatedBy: "\r\n").first ?? ""
                let parts = firstLine.components(separatedBy: " ")
                let method = parts.first ?? ""
                let path = parts.count > 1 ? parts[1] : "/"
                if method == "POST" {
                    var id: String?, text: String?
                    if let r = req.range(of: "\r\n\r\n") {
                        let body = String(req[r.upperBound...])
                        if let bd = body.data(using: .utf8),
                           let j = try? JSONSerialization.jsonObject(with: bd) as? [String: Any] {
                            id = j["id"] as? String
                            text = j["text"] as? String
                        }
                    }
                    DispatchQueue.main.async { self.onMessage(path, id, text) }
                }
                // (OPTIONS preflight: doar răspundem cu headerele de mai jos.)
            }
            // Headere care lasă browserul (inclusiv Private Network Access) să
            // accepte requestul din pagina https către loopback.
            let resp = "HTTP/1.1 200 OK\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type\r\n" +
                "Access-Control-Allow-Private-Network: true\r\n" +
                "Content-Length: 0\r\nConnection: close\r\n\r\n"
            conn.send(content: resp.data(using: .utf8), completion: .contentProcessed { _ in conn.cancel() })
        }
    }
}

final class Controller: NSObject, NSApplicationDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let secret = loadSecret()
    var server: PinServer?
    var pinnedId: String?
    var pinnedText = ""
    var textHidden = UserDefaults.standard.bool(forKey: "textHidden")

    var isPinned: Bool { pinnedId != nil }

    func applicationDidFinishLaunching(_ notification: Notification) {
        applyTitle()   // pornește ascuns — nimic pinuit
        buildMenu()
        server = PinServer { [weak self] path, id, text in
            self?.handleMessage(path: path, id: id, text: text)
        }
        server?.start()
    }

    // Pin/unpin venit de la app-ul web (loopback).
    func handleMessage(path: String, id: String?, text: String?) {
        if path.contains("unpin") || id == nil {
            pinnedId = nil
            pinnedText = ""
        } else {
            pinnedId = id
            pinnedText = text ?? ""
        }
        applyTitle()
        buildMenu()
    }

    func applyTitle() {
        // Nimic pinuit → iconița dispare complet din bara de meniu.
        guard isPinned, let button = item.button else {
            item.isVisible = false
            return
        }
        item.isVisible = true
        let text = textHidden
            ? ""
            : (pinnedText.count > 42 ? String(pinnedText.prefix(41)) + "…" : pinnedText)
        let color = NSColor(red: 0xd9 / 255, green: 0x1f / 255, blue: 0x7f / 255, alpha: 1)
        button.title = ""
        button.image = badge(text: text, color: color)
        button.image?.isTemplate = false
    }

    func buildMenu() {
        let menu = NSMenu()
        menu.autoenablesItems = false
        let head = NSMenuItem(title: isPinned ? pinnedText : "Nimic pinuit", action: nil, keyEquivalent: "")
        head.isEnabled = false
        menu.addItem(head)
        menu.addItem(.separator())
        let doneItem = NSMenuItem(title: "Done", action: #selector(markDone), keyEquivalent: "d")
        doneItem.isEnabled = isPinned
        menu.addItem(doneItem)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: textHidden ? "Arată textul" : "Ascunde textul",
                                action: #selector(toggleText), keyEquivalent: "h"))
        menu.addItem(NSMenuItem(title: "Deschide Elite Deux", action: #selector(open), keyEquivalent: "o"))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Ieși", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        for i in menu.items where i.action != nil {
            i.target = i.action == #selector(NSApplication.terminate(_:)) ? nil : self
        }
        item.menu = menu
    }

    @objc func open() {
        if let url = URL(string: baseURL + "/elite-deux") { NSWorkspace.shared.open(url) }
    }

    // Marchează task-ul pinuit complet (un singur POST) și golește pin-ul local.
    @objc func markDone() {
        guard let id = pinnedId,
              var req = URL(string: baseURL + "/api/elite-deux/next").map({ URLRequest(url: $0) }) else { return }
        req.httpMethod = "POST"
        req.setValue(secret, forHTTPHeaderField: "x-elite-secret")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["id": id])
        req.timeoutInterval = 15
        URLSession.shared.dataTask(with: req).resume()

        pinnedId = nil
        pinnedText = ""
        applyTitle()
        buildMenu()
    }

    @objc func toggleText() {
        textHidden.toggle()
        UserDefaults.standard.set(textHidden, forKey: "textHidden")
        applyTitle()
        buildMenu()
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
}

let app = NSApplication.shared
let controller = Controller()
app.delegate = controller
app.setActivationPolicy(.accessory)
app.run()
