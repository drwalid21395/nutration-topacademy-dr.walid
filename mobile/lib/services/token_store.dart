import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// تخزين آمن للتوكن وبيانات الجلسة.
class TokenStore {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static const _kToken = 'bridge_token';
  static const _kEmail = 'bridge_email';
  static const _kName = 'bridge_name';
  static const _kLastSync = 'bridge_last_sync';

  Future<void> save({required String token, required String email, required String name}) async {
    await _storage.write(key: _kToken, value: token);
    await _storage.write(key: _kEmail, value: email);
    await _storage.write(key: _kName, value: name);
  }

  Future<String?> get token => _storage.read(key: _kToken);
  Future<String?> get email => _storage.read(key: _kEmail);
  Future<String?> get name => _storage.read(key: _kName);

  Future<DateTime?> get lastSyncAt async {
    final v = await _storage.read(key: _kLastSync);
    return v == null ? null : DateTime.tryParse(v);
  }

  Future<void> setLastSync(DateTime d) async {
    await _storage.write(key: _kLastSync, value: d.toIso8601String());
  }

  Future<bool> hasSession() async {
    final t = await _storage.read(key: _kToken);
    return t != null && t.isNotEmpty;
  }

  Future<void> clear() async {
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kEmail);
    await _storage.delete(key: _kName);
  }
}
