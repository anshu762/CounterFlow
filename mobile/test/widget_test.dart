import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:counterflow_app/core/riverpod_config.dart';
import 'package:counterflow_app/features/status/status_providers.dart';
import 'package:counterflow_app/features/status/status_screen.dart';

Widget _wrap(List<Override> overrides) => ProviderScope(
      retry: noRetry,
      overrides: overrides,
      child: const MaterialApp(home: StatusScreen()),
    );

Future<void> _settle(WidgetTester tester) async {
  await tester.pump(); // let the futures complete
  await tester.pump(const Duration(seconds: 1)); // let entrance animations finish
}

void main() {
  testWidgets('shows Operational for API and database when both are healthy', (tester) async {
    await tester.pumpWidget(_wrap([
      apiHealthProvider.overrideWith((ref) async => <String, dynamic>{
            'status': 'ok',
            'service': 'counterflow-api',
            'version': '0.1.0',
            'environment': 'test',
            'uptimeSeconds': 90,
          }),
      dbHealthProvider.overrideWith((ref) async => <String, dynamic>{
            'status': 'ok',
            'database': <String, dynamic>{'configured': true, 'ok': true, 'latencyMs': 12},
          }),
    ]));
    await _settle(tester);

    expect(find.text('Operational'), findsNWidgets(2));
    expect(find.text('counterflow-api'), findsOneWidget);
    expect(find.text('12 ms'), findsOneWidget);

    await tester.pumpWidget(const SizedBox()); // dispose looping animations cleanly
  });

  testWidgets('shows Unreachable when the API cannot be reached', (tester) async {
    await tester.pumpWidget(_wrap([
      apiHealthProvider.overrideWith((ref) async => throw Exception('offline')),
      dbHealthProvider.overrideWith((ref) async => throw Exception('offline')),
    ]));
    await _settle(tester);

    expect(find.text('Unreachable'), findsNWidgets(2));
    expect(find.text('Cannot reach the API. Is the backend running?'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });
}