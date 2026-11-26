import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

/**
 * Hook for accessing authentication state and actions.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
