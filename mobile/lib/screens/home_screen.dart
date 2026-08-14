import 'dart:async';
import 'package:flutter/material.dart';
import '../config.dart';
import '../services/api_client.dart';
import '../services/health_service.dart';
import '../services/sync_manager.dart';
import '../services/token_store.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _store = TokenStore();
  HealthBridge? _health;
  String? _healthStatus;
  bool _busy = false;
  String? _lastMessage;
  DateTime? _lastSync;
  Timer? _autoTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _autoTimer = Timer.periodic(
      const Duration(seconds: AppConfig.autoSyncIntervalSeconds),
      (_) => _sync(auto: true),
    );
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final ls = await _store.lastSyncAt;
    if (mounted) setState(() => _lastSync = ls);
  }

  Future<void> _grantPermissions() async {
    setState(() {
      _busy = true;
      _lastMessage = null;
    });
    final health = HealthBridge();
    final ok = await health.init();
    if (!mounted) return;
    setState(() {
      _health = ok ? health : null;
      _healthStatus = ok
          ? (health.isAndroid ? 'متصل بـ Health Connect ✓' : 'متصل بـ Apple Health ✓')
          : 'تعذر منح الأذونات: ${health.lastError}';
      _busy = false;
    });
  }

  Future<void> _sync({bool auto = false}) async {
    if (_busy) return;
    final health = _health;
    if (health == null) {
      setState(() => _lastMessage = 'اربط المجمّع الصحي أولًا (زر «منح الأذونات»).');
      return;
    }
    setState(() {
      _busy = true;
      _lastMessage = auto ? 'مزامنة تلقائية…' : 'جارٍ المزامنة…';
    });
    try {
      final token = await _store.token;
      if (token == null) throw ApiException('انتهت الجلسة — سجّل الدخول مجددًا.');
      final api = ApiClient(token: token);
      final manager = SyncManager(api: api, health: health, store: _store);
      final report = await manager.run();
      setState(() {
        _lastMessage = report.message;
        _lastSync = DateTime.now();
      });
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 401) {
        await _store.clear();
        if (mounted) {
          Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
        }
        return;
      }
      setState(() => _lastMessage = 'فشل: ${e.message}');
    } catch (e) {
      if (!mounted) return;
      setState(() => _lastMessage = 'فشل المزامنة: ${e.toString().split('\n').first}');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logout() async {
    await _store.clear();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ربط الساعة الذكية'),
        actions: [
          IconButton(onPressed: _logout, icon: const Icon(Icons.logout), tooltip: 'خروج'),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _infoCard(),
          const SizedBox(height: 12),
          _statusCard(),
          const SizedBox(height: 12),
          _actionButtons(),
          if (_lastMessage != null) ...[
            const SizedBox(height: 12),
            Card(
              color: const Color(0xFFE7F5F3),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(_lastMessage!, style: const TextStyle(color: Color(0xFF0F766E))),
              ),
            ),
          ],
          const SizedBox(height: 12),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('كيف يعمل؟', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  SizedBox(height: 8),
                  Text('أي ساعة مرتبطة بهاتفك (Apple Health أو Health Connect) تُرسل بياناتها تلقائيًا للموقع، ويتحدث هدفك الغذائي فورًا — مهما كان نوع الساعة.'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard() {
    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.watch, color: Color(0xFF0F766E)),
                SizedBox(width: 8),
                Text('الموقع', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              AppConfig.apiBase,
              style: TextStyle(fontSize: 12, color: Colors.grey),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Text('آخر مزامنة: ${_lastSync == null ? '—' : '${_lastSync!.hour}:${_lastSync!.minute.toString().padLeft(2, '0')} — ${_lastSync!.day}/${_lastSync!.month}/${_lastSync!.year}'}'),
          ],
        ),
      ),
    );
  }

  Widget _statusCard() {
    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              _healthStatus == null ? Icons.bluetooth_disabled : Icons.bluetooth_connected,
              color: _healthStatus == null ? Colors.grey : Colors.green,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _healthStatus ?? 'لم يُربط المجمّع الصحي بعد',
                style: const TextStyle(fontSize: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionButtons() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _busy ? null : _grantPermissions,
            icon: const Icon(Icons.favorite_outline),
            label: Text(_healthStatus == null ? 'منح أذونات القراءة من الهاتف' : 'إعادة طلب الأذونات'),
            style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _busy ? null : _sync,
            icon: const Icon(Icons.sync),
            label: Text(_busy ? 'جارٍ المزامنة…' : 'مزامنة الآن (آخر ٧ أيام)'),
            style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
          ),
        ),
      ],
    );
  }
}
