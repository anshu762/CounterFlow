import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/config.dart';
import 'status_card.dart';
import 'status_providers.dart';

String _formatUptime(int totalSeconds) {
  final h = totalSeconds ~/ 3600;
  final m = (totalSeconds % 3600) ~/ 60;
  final s = totalSeconds % 60;
  if (h > 0) return '${h}h ${m}m';
  if (m > 0) return '${m}m ${s}s';
  return '${s}s';
}

class StatusScreen extends ConsumerWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.watch(apiHealthProvider);
    final db = ref.watch(dbHealthProvider);

    final apiState = api.when(
      skipLoadingOnReload: true,
      data: (_) => ServiceState.ok,
      loading: () => ServiceState.loading,
      error: (_, _) => ServiceState.error,
    );
    final dbState = db.when(
      skipLoadingOnReload: true,
      data: (d) => d['status'] == 'ok' ? ServiceState.ok : ServiceState.degraded,
      loading: () => ServiceState.loading,
      error: (_, _) => ServiceState.error,
    );

    final apiData = api.asData?.value;
    final dbInfo = db.asData?.value['database'] as Map<String, dynamic>?;

    final apiRows = apiData != null
        ? [
            MapEntry('Service', '${apiData['service']}'),
            MapEntry('Version', '${apiData['version']}'),
            MapEntry('Environment', '${apiData['environment']}'),
            MapEntry('Uptime', _formatUptime((apiData['uptimeSeconds'] as num?)?.toInt() ?? 0)),
          ]
        : [MapEntry('Endpoint', apiBaseUrl)];

    final dbRows = dbInfo != null
        ? [
            MapEntry('Configured', dbInfo['configured'] == true ? 'Yes' : 'No'),
            MapEntry('Connected', dbInfo['ok'] == true ? 'Yes' : 'No'),
            if (dbInfo['latencyMs'] != null) MapEntry('Latency', '${dbInfo['latencyMs']} ms'),
          ]
        : [MapEntry('Endpoint', '$apiBaseUrl/health/db')];

    final fetching = api.isLoading || db.isLoading;

    void refresh() {
      ref.invalidate(apiHealthProvider);
      ref.invalidate(dbHealthProvider);
    }

    final apiCard = StatusCard(
      title: 'API server',
      icon: Icons.dns_rounded,
      state: apiState,
      rows: apiRows,
      note: apiState == ServiceState.error ? 'Cannot reach the API. Is the backend running?' : null,
      index: 0,
    );
    final dbCard = StatusCard(
      title: 'Database (Neon)',
      icon: Icons.storage_rounded,
      state: dbState,
      rows: dbRows,
      note: dbState == ServiceState.degraded
          ? 'API is up, but the database check failed.'
          : dbState == ServiceState.error
              ? 'Cannot reach the API.'
              : null,
      index: 1,
    );

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFFFF7ED), Color(0xFFFAFAF9), Color(0xFFFEF3C7)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const _Header(),
                    const SizedBox(height: 24),
                    LayoutBuilder(
                      builder: (context, c) {
                        if (c.maxWidth >= 640) {
                          return Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(child: apiCard),
                              const SizedBox(width: 16),
                              Expanded(child: dbCard),
                            ],
                          );
                        }
                        return Column(
                          children: [apiCard, const SizedBox(height: 16), dbCard],
                        );
                      },
                    ),
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      onPressed: fetching ? null : refresh,
                      icon: fetching
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.refresh_rounded),
                      label: Text(fetching ? 'Checking…' : 'Refresh status'),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Auto-refreshes every 15 seconds',
                      style: TextStyle(fontSize: 12, color: Color(0xFF78716C)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      apiBaseUrl,
                      style: const TextStyle(fontSize: 12, color: Color(0xFFA8A29E)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: brandOrange,
            borderRadius: BorderRadius.circular(18),
            boxShadow: const [
              BoxShadow(color: Color(0x4DEA580C), blurRadius: 16, offset: Offset(0, 6)),
            ],
          ),
          child: const Icon(Icons.coffee_rounded, color: Colors.white, size: 32),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .rotate(begin: -0.02, end: 0.02, duration: 2.seconds, curve: Curves.easeInOut),
        const SizedBox(height: 16),
        RichText(
          text: const TextSpan(
            style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Color(0xFF1C1917)),
            children: [
              TextSpan(text: 'Counter'),
              TextSpan(text: 'Flow', style: TextStyle(color: brandOrange)),
            ],
          ),
        ).animate().fadeIn(duration: 500.ms).slideY(begin: -0.3, end: 0),
        const SizedBox(height: 4),
        const Text('System status', style: TextStyle(color: Color(0xFF57534E))),
      ],
    );
  }
}