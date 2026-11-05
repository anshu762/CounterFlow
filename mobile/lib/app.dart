import 'package:flutter/material.dart';
import 'core/router.dart';
import 'core/theme.dart';

class CounterFlowApp extends StatelessWidget {
  const CounterFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'CounterFlow',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: appRouter,
    );
  }
}