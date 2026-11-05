/// Riverpod 3 retries failed providers automatically by default.
/// CounterFlow shows errors immediately (with a manual Refresh), so retry is disabled.
Duration? noRetry(int retryCount, Object error) => null;