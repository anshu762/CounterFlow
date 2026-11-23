import { QueryClient } from '@tanstack/react-query';

const isClientError = (err) => {
  const status = err?.response?.status;
  return status >= 400 && status < 500;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Retrying a 4xx never helps; network blips and 5xx get two more tries.
      retry: (count, err) => !isClientError(err) && count < 2,
    },
  },
});