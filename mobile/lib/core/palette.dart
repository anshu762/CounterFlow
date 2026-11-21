import 'package:flutter/material.dart';

/// Heading font (bundled in assets/fonts, declared in pubspec.yaml).
const String displayFont = 'PlayfairDisplay';

/// Single source of truth for CounterFlow colours: "Classic Café" theme.
/// Keep in sync with dashboard/src/index.css.
abstract final class AppColors {
  // Brand: deep burgundy
  static const Color brand50 = Color(0xFFFBF3F3);
  static const Color brand100 = Color(0xFFF5E1E2);
  static const Color brand = Color(0xFF7F1D2D);
  static const Color brandDark = Color(0xFF651624);

  // Accent: antique gold
  static const Color gold100 = Color(0xFFF5EBCB);
  static const Color gold200 = Color(0xFFEBD9A0);
  static const Color gold400 = Color(0xFFCBA84F);
  static const Color gold = Color(0xFFB58B34);

  // Surfaces and text (warm neutrals)
  static const Color paper = Color(0xFFFAF6EE); // page background
  static const Color card = Color(0xFFFFFDF9); // cards
  static const Color line = Color(0xFFE6DCCB); // borders
  static const Color sand = Color(0xFFF3EDE2); // skeletons, soft fills
  static const Color ink = Color(0xFF231A13); // main text
  static const Color muted = Color(0xFF7A6B58); // secondary text
  static const Color softText = Color(0xFF5E5143);

  // Status colours (kept recognisable on purpose)
  static const Color success = Color(0xFF047857);
  static const Color successBg = Color(0xFFECFDF5);
  static const Color warning = Color(0xFFB45309);
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color danger = Color(0xFFB91C1C);
  static const Color dangerBg = Color(0xFFFEF2F2);
}