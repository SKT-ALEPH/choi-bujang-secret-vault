import Foundation
import Security
import CryptoKit

// Only this app's random encryption key is stored in Keychain. Payloads use stdin.
let service = "app.keshev.personal-ai.oauth.v1"
let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                          kSecAttrService as String: service,
                          kSecAttrAccount as String: "credential-encryption"]

func storedKey() throws -> Data {
    var lookup = query
    lookup[kSecReturnData as String] = true
    var result: CFTypeRef?
    let status = SecItemCopyMatching(lookup as CFDictionary, &result)
    if status == errSecSuccess, let data = result as? Data, data.count == 32 { return data }
    guard status == errSecItemNotFound else { throw NSError(domain: service, code: 1) }
    // Decryption must never replace a missing key with a newly generated key.
    guard CommandLine.arguments.dropFirst().first == "encrypt" else { throw NSError(domain: service, code: 2) }
    var data = Data(count: 32)
    let randomStatus = data.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }
    guard randomStatus == errSecSuccess else { throw NSError(domain: service, code: 3) }
    var create = query
    create[kSecValueData as String] = data
    create[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    let added = SecItemAdd(create as CFDictionary, nil)
    if added == errSecDuplicateItem { return try storedKey() }
    guard added == errSecSuccess else { throw NSError(domain: service, code: 4) }
    return data
}

do {
    let input = FileHandle.standardInput.readDataToEndOfFile()
    guard input.count <= 1024 * 1024 else { throw NSError(domain: service, code: 5) }
    let key = SymmetricKey(data: try storedKey())
    let output: Data
    switch CommandLine.arguments.dropFirst().first {
    case "encrypt": output = try AES.GCM.seal(input, using: key).combined!
    case "decrypt": output = try AES.GCM.open(AES.GCM.SealedBox(combined: input), using: key)
    default: throw NSError(domain: service, code: 6)
    }
    FileHandle.standardOutput.write(output)
} catch {
    FileHandle.standardError.write(Data("KEYCHAIN_UNAVAILABLE\n".utf8))
    exit(1)
}
