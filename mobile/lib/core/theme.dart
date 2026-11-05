import 'package:flutter/material.dart';

const Color brandColor = Color(0xFFEA580C);

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: brandColor);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: const Color(0xFFFAFAF9),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(44, 48), // min 44px tap target
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
  );
}