import 'dart:async';
import 'package:flutter/material.dart';
import '../config.dart';
import '../services/api_client.dart';
import '../services/health_service.dart';
import '../services/safety_monitor.dart';
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
  SafetyMonitor? _safety;
  String? _healthStatus;
  bool _busy = false;
  String? _lastMessage;
  DateTime? _lastSync;
  Timer? _autoTimer;
  bool _safetyActive = false;

  @override
  void initState() {
    super.initState();
    _load();
    // محاولة بدء المراقبة تلقائيًا إذا كانت الأذونات ممنوحة مسبقًا
    _tryAutoStart();
    _autoTimer = Timer.periodic(
      const Duration(seconds: AppConfig.autoSyncIntervalSeconds),
      (_) => _sync(auto: true),
    );
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _safety?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final ls = await _store.lastSyncAt;
    if (mounted) setState(() => _lastSync = ls);
  }

  /// محاولة بدء المراقبة تلقائيًا عند فتح التطبيق
  Future<void> _tryAutoStart() async {
    final health = HealthBridge();
    final ok = await health.init();
    if (!mounted) return;
    if (ok) {
      setState(() {
        _health = health;
        _healthStatus = health.isAndroid
            ? 'متصل بـ Health Connect ✓'
            : 'متصل بـ Apple Health ✓';
      });
      _startSafety(health);
      // مزامنة تلقائية أولية
      _sync(auto: true);
    }
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
    if (ok) {
      _startSafety(health);
      _sync(auto: true);
    }
  }

  void _startSafety(HealthBridge health) {
    _safety?.dispose();
    _store.token.then((t) {
      if (t != null && mounted) {
        final api = ApiClient(token: t);
        final monitor = SafetyMonitor(api: api, health: health);
        monitor.start();
        setState(() {
          _safety = monitor;
          _safetyActive = true;
          _lastMessage = 'مراقبة السلامة نشطة — تقرأ النبض كل 15 ثانية';
        });
      }
    });
  }

  void _stopSafety() {
    _safety?.stop();
    setState(() {
      _safetyActive = false;
      _lastMessage = 'تم إيقاف مراقبة السلامة';
    });
  }

  Future<void> _sync({bool auto = false}) async {
    if (_busy) return;
    final health = _health;
    if (health == null) {
      if (!auto) {
        setState(() => _lastMessage = 'اربط المجمّع الصحي أولًا (زر «منح الأذونات»).');
      }
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
    _safety?.dispose();
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
          _safetyCard(),
          const SizedBox(height: 12),
          _actionButtons(),
          if (_lastMessage != null) ...[
            const SizedBox(height: 12),
            Card(
              color: _safetyActive
                  ? const Color(0xFFE7F5F3)
                  : const Color(0xFFF8F9FA),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  _lastMessage!,
                  style: TextStyle(
                    color: _safetyActive
                        ? const Color(0xFF0F766E)
                        : const Color(0xFF6C757D),
                  ),
                ),
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
                  SizedBox(height: 8),
                  Text('مراقبة السلامة تقرأ النبض والأكسجين كل 15 ثانية أثناء السباحة، وعند رصد حالة طوارئ تتصل تلقائيًا بالرقم المسجل.', style: TextStyle(color: Color(0xFFDC3545))),
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

  Widget _safetyCard() {
    return Card(
      elevation: 1,
      color: _safetyActive ? const Color(0xFFD1E7DD) : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _safetyActive ? Icons.shield : Icons.shield_outlined,
                  color: _safetyActive ? Colors.green : Colors.grey,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _safetyActive ? 'مراقبة السلامة نشطة ✓' : 'مراقبة السلامة متوقفة',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: _safetyActive ? const Color(0xFF0F5132) : Colors.grey,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              _safetyActive
                  ? 'تقرأ النبض و الأكسجين كل 15 ثانية — عند رصد طوارئ تتصل بالرقم المسجل'
                  : 'فعّل المراقبة لقراءة النبض والأكسجين تلقائيًا وإرسالها للموقع',
              style: TextStyle(
                fontSize: 13,
                color: _safetyActive ? const Color(0xFF0F5132) : Colors.grey[600],
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
        if (_safetyActive)
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _stopSafety,
              icon: const Icon(Icons.stop, color: Colors.red),
              label: const Text('إيقاف مراقبة السلامة', style: TextStyle(color: Colors.red)),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                side: const BorderSide(color: Colors.red),
              ),
            ),
          )
        else if (_health != null)
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _startSafety(_health!),
              icon: const Icon(Icons.shield, color: Color(0xFF0F766E)),
              label: const Text('تفعيل مراقبة السلامة', style: TextStyle(color: Color(0xFF0F766E))),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                side: const BorderSide(color: Color(0xFF0F766E)),
              ),
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
