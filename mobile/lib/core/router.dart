import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../features/status/status_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (context, state) => const StatusScreen()),
  ],
  errorBuilder: (context, state) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('404', style: TextStyle(fontSize: 56, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('Page not found'),
          const SizedBox(height: 16),
          FilledButton(onPressed: () => context.go('/'), child: const Text('Back to home')),
        ],
      ),
    ),
  ),
);