import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

/// استثناء واضح لأخطاء الخادم.
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});
  @override
  String toString() => message;
}

/// نتيجة تسجيل الدخول.
class LoginResult {
  final String token;
  final String userId;
  final String name;
  final String email;
  LoginResult({
    required this.token,
    required this.userId,
    required this.name,
    required this.email,
  });
}

/// عميل الخادم: دخول + إرسال بيانات النشاط والتدريبات بنفس صيغة الويب.
class ApiClient {
  final String baseUrl;
  final Map<String, String> _headers;

  ApiClient({String? baseUrl, String? token})
      : baseUrl = baseUrl ?? AppConfig.apiBase,
        _headers = {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        };

  static const Duration _timeout = Duration(seconds: 30);

  Future<dynamic> _post(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$baseUrl$path');
    final res = await http.post(uri, headers: _headers, body: jsonEncode(body)).timeout(_timeout);
    final data = _decode(res);
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    final msg = data is Map && data['error'] is String ? data['error'] as String : 'خطأ غير متوقع ($res.statusCode)';
    throw ApiException(msg, statusCode: res.statusCode);
  }

  /// تسجيل دخول المستخدم والحصول على توكن الجسر.
  static Future<LoginResult> login({required String baseUrl, required String email, required String password, String? deviceName}) async {
    final res = await http
        .post(
          Uri.parse('$baseUrl/api/mobile/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email, 'password': password, 'deviceName': deviceName}),
        )
        .timeout(_timeout);
    final data = _decode(res);
    if (res.statusCode != 200) {
      final msg = data is Map && data['error'] is String ? data['error'] as String : 'فشل تسجيل الدخول';
      throw ApiException(msg, statusCode: res.statusCode);
    }
    return LoginResult(
      token: data['token'] as String,
      userId: data['user']['id'] as String,
      name: data['user']['name'] as String? ?? '',
      email: data['user']['email'] as String? ?? email,
    );
  }

  /// إرسال نشاط يومي لليوم المعطى.
  Future<void> pushActivity(Map<String, dynamic> activity) async {
    await _post('/api/health/activity', {'provider': AppConfig.provider, 'activity': activity});
  }

  /// إرسال عيّنة قياس حيوية (سلامة).
  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    return _post(path, body);
  }

  /// إرسال دفعة تدريبات.
  Future<void> pushWorkouts(List<Map<String, dynamic>> workouts) async {
    if (workouts.isEmpty) return;
    await _post('/api/health/workouts', {'provider': AppConfig.provider, 'workouts': workouts});
  }

  static dynamic _decode(http.Response res) {
    try {
      return jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      return null;
    }
  }

  bool get isAuthed => _headers.containsKey('Authorization');
}

/// مفيد عند فحص الاتصال: هل الخادم حي؟
Future<bool> pingServer(String baseUrl) async {
  try {
    final res = await http
        .get(Uri.parse(baseUrl), headers: {'Accept': 'application/json'})
        .timeout(ApiClient._timeout);
    return res.statusCode < 500;
  } catch (_) {
    return false;
  }
}
