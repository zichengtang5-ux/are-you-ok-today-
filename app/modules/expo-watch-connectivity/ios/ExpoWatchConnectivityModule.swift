import ExpoModulesCore
import Security
import UIKit
import WatchConnectivity

private enum WatchPayloadVault {
  static let service = "com.todayok.app.watch-connectivity"
  static let account = "latest-context"

  static func save(_ payload: String) throws {
    guard let data = payload.data(using: .utf8) else {
      throw NSError(domain: "ExpoWatchConnectivity", code: 1)
    }

    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)

    var attributes = query
    attributes[kSecValueData as String] = data
    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
    }
  }

  static func load() -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  static func clear() {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
  }
}

private final class PhoneWatchSession: NSObject, WCSessionDelegate {
  static let shared = PhoneWatchSession()

  private var pendingPayload: String?
  private var currentPayload: String? = WatchPayloadVault.load()
  private var needsClear: Bool

  private override init() {
    needsClear = currentPayload == nil
    super.init()
  }

  var availability: [String: Bool] {
    guard WCSession.isSupported() else {
      return ["supported": false, "paired": false, "installed": false]
    }
    let session = WCSession.default
    return [
      "supported": true,
      "paired": session.isPaired,
      "installed": session.isWatchAppInstalled,
    ]
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func sync(payload: String) throws {
    guard let data = payload.data(using: .utf8),
          (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else {
      throw NSError(
        domain: "ExpoWatchConnectivity",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Watch context must be a JSON object"]
      )
    }

    try WatchPayloadVault.save(payload)
    currentPayload = payload
    needsClear = false
    sendOrQueue(payload)
  }

  func clear() {
    WatchPayloadVault.clear()
    currentPayload = nil
    pendingPayload = nil
    needsClear = true
    sendClearOrQueue()
  }

  private func sendOrQueue(_ payload: String) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else {
      pendingPayload = payload
      activate()
      return
    }
    do {
      try session.updateApplicationContext(["payload": payload])
      pendingPayload = nil
      if session.isReachable {
        // applicationContext is the durable fallback; sendMessage invalidates a visible Watch now.
        session.sendMessage(["payload": payload], replyHandler: nil, errorHandler: nil)
      }
    } catch {
      pendingPayload = payload
    }
  }

  private func sendClearOrQueue() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else {
      activate()
      return
    }
    do {
      try session.updateApplicationContext(["cleared": true])
      needsClear = false
    } catch {
      needsClear = true
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated, error == nil else { return }
    if needsClear {
      sendClearOrQueue()
      return
    }
    if let payload = pendingPayload ?? currentPayload {
      sendOrQueue(payload)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    guard message["request"] as? String == "configuration",
          let payload = currentPayload else {
      replyHandler(["configured": false])
      return
    }
    replyHandler(["payload": payload])
  }
}

public final class WatchConnectivityAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    PhoneWatchSession.shared.activate()
    return true
  }
}

public final class ExpoWatchConnectivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoWatchConnectivity")

    OnCreate {
      PhoneWatchSession.shared.activate()
    }

    Function("getAvailability") {
      PhoneWatchSession.shared.availability
    }

    AsyncFunction("sync") { (payloadJSON: String) in
      try PhoneWatchSession.shared.sync(payload: payloadJSON)
      return PhoneWatchSession.shared.availability
    }

    AsyncFunction("clear") {
      PhoneWatchSession.shared.clear()
    }
  }
}
