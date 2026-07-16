import Foundation
import Security

final class WatchCredentialStore {
  static let shared = WatchCredentialStore()

  private let service = "com.todayok.app.watch-auth"
  private let account = "phone-context"

  private init() {}

  func load() -> WatchPhoneContext? {
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
    return try? JSONDecoder().decode(WatchPhoneContext.self, from: data)
  }

  @discardableResult
  func save(_ context: WatchPhoneContext) -> Bool {
    guard let data = try? JSONEncoder().encode(context) else { return false }
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)

    var attributes = query
    attributes[kSecValueData as String] = data
    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    return SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess
  }

  func updateTokens(accessToken: String, refreshToken: String) {
    guard var context = load() else { return }
    context.accessToken = accessToken
    context.refreshToken = refreshToken
    save(context)
  }

  func clear() {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
  }
}

final class WatchStatusCache {
  static let shared = WatchStatusCache()
  private let key = "today-ok-watch.latest-status"

  private init() {}

  func load() -> WatchReplyStatus? {
    guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
    return try? JSONDecoder().decode(WatchReplyStatus.self, from: data)
  }

  func save(_ status: WatchReplyStatus) {
    guard let data = try? JSONEncoder().encode(status) else { return }
    UserDefaults.standard.set(data, forKey: key)
  }

  func clear() {
    UserDefaults.standard.removeObject(forKey: key)
  }
}
