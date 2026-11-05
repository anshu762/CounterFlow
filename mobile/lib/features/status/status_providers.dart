import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';

/// Re-checks itself every 15 seconds while the screen is open.
void _autoRefresh(Ref ref) {
  final timer = Timer(const Duration(seconds: 15), ref.invalidateSelf);
  ref.onDispose(timer.cancel);
}

final apiHealthProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  _autoRefresh(ref);
  final res = await ref.watch(dioProvider).get<Map<String, dynamic>>('/health');
  return res.data ?? <String, dynamic>{};
});

final dbHealthProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  _autoRefresh(ref);
  // The API answers 503 with a JSON body when the DB is down: treat it as data, not a crash.
  final res = await ref.watch(dioProvider).get<Map<String, dynamic>>(
        '/health/db',
        options: Options(validateStatus: (s) => s == 200 || s == 503),
      );
  return res.data ?? <String, dynamic>{};
});