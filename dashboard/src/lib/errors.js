// Turns any thrown value into { status, code, message, details } for forms and toasts.
export function describeError(err) {
  if (err?.response) {
    const status = err.response.status;
    const body = err.response.data?.error;
    return {
      status,
      code: body?.code ?? `HTTP_${status}`,
      message:
        body?.message ??
        (status >= 500 ? 'The server had a problem. Please try again.' : 'The request failed.'),
      details: body?.details,
    };
  }
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
    return {
      status: 0,
      code: 'TIMEOUT',
      message: 'The server took too long to answer. It may be waking up, so try again in a moment.',
    };
  }
  if (err?.request || err?.code === 'ERR_NETWORK') {
    return {
      status: 0,
      code: 'NETWORK',
      message: 'Cannot reach the server. Check your connection and try again.',
    };
  }
  return { status: 0, code: 'UNKNOWN', message: err?.message || 'Something went wrong.' };
}