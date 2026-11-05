import 'package:flutter/foundation.dart';

const String _definedApiUrl = String.fromEnvironment('API_URL');

/// Resolve the backend URL.
/// Override with: flutter run --dart-define=API_URL=https://your-api.onrender.com
String get apiBaseUrl {
  if (_definedApiUrl.isNotEmpty) return _definedApiUrl;
  if (kIsWeb) return 'http://localhost:5000';
  if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:5000';
  return 'http://localhost:5000';
}