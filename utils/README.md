# @donotdev/utils

Core utilities for the DoNotDev framework. This package provides essential utilities for managing state, network connectivity, authentication, and error handling without circular dependencies.

## 📦 Installation

```bash
bun add @donotdev/utils @donotdev/types
```

## 🧰 Utilities Overview

This package includes the following core utilities:

- **EventEmitter**: Simple event-based communication system
- **Subject**: Observable-like pattern for reactive programming
- **TokenManager**: Authentication token lifecycle management
- **NetworkManager**: Network connectivity monitoring and handling
- **Error Handling**: Standardized error handling utilities

## 📝 Usage Guide

### EventEmitter

EventEmitter provides a simple event-based communication system for your application.

```typescript
import { EventEmitter } from '@donotdev/utils';

// Create a new EventEmitter
const events = new EventEmitter();

// Subscribe to an event
const unsubscribe = events.on('userUpdated', (userData) => {
  console.log('User updated:', userData);
});

// Subscribe once to an event
events.once('appInitialized', () => {
  console.log('App initialized!');
});

// Emit an event
events.emit('userUpdated', { id: 1, name: 'John Doe' });

// Unsubscribe from an event
unsubscribe();

// Check if an event has listeners
if (events.hasListeners('appInitialized')) {
  console.log('App initialized event has listeners');
}

// Get the number of listeners
const count = events.listenerCount('userUpdated');

// Remove all listeners for an event
events.removeAllListeners('userUpdated');

// Remove all listeners for all events
events.removeAllListeners();
```

### Subject, BehaviorSubject, and ReplaySubject

Subjects provide a way to implement the observer pattern for reactive programming.

```typescript
import { Subject, BehaviorSubject, ReplaySubject } from '@donotdev/utils';

// Regular Subject - doesn't provide initial value
const userSubject = new Subject<User>();

// Subscribe to the subject
const subscription = userSubject.subscribe({
  next: (user) => console.log('User updated:', user),
  error: (err) => console.error('Error:', err),
  complete: () => console.log('Subject completed'),
});

// Alternative subscription syntax
userSubject.subscribe(
  (user) => console.log('User updated:', user),
  (err) => console.error('Error:', err),
  () => console.log('Subject completed')
);

// Emit a new value
userSubject.next({ id: 1, name: 'John Doe' });

// Complete the subject
userSubject.complete();

// Unsubscribe
subscription.unsubscribe();

// BehaviorSubject - always provides the latest value to new subscribers
const countBehavior = new BehaviorSubject<number>(0);
console.log('Current count:', countBehavior.getValue()); // 0
countBehavior.next(1);
console.log('Current count:', countBehavior.getValue()); // 1

// ReplaySubject - replays a specified number of previous values
const replaySubject = new ReplaySubject<string>(2); // Buffer size of 2
replaySubject.next('First');
replaySubject.next('Second');
replaySubject.next('Third');

// New subscribers will only get "Second" and "Third" (buffer size is 2)
replaySubject.subscribe((value) => console.log('Replay:', value));
```

### TokenManager

TokenManager handles authentication token lifecycle, including refresh, expiration, and status tracking.

```typescript
import { TokenManager } from '@donotdev/utils';
import type { TokenInfo } from '@donotdev/types';

// Create a token manager (with optional Firebase Auth instance)
const tokenManager = new TokenManager(auth, {
  refreshBufferMs: 300000, // 5 minutes before expiration to consider "expiring soon"
  autoRefresh: true,
  maxRefreshAttempts: 3,
  onTokenExpired: () => console.log('Token expired and could not be refreshed'),
  onFatalError: (error) => console.error('Fatal token error:', error),
});

// Initialize with token information
tokenManager.initialize({
  token: 'your-jwt-token',
  expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour expiration
  refreshToken: 'your-refresh-token', // optional
});

// Get the current token info
const tokenInfo = tokenManager.getTokenInfo();
console.log('Token status:', tokenInfo.status);

// Get a valid token (will auto-refresh if needed)
const token = await tokenManager.getValidToken();

// Observe token changes
tokenManager.observeTokenInfo().subscribe((info) => {
  console.log('Token updated:', info);
});

// Register a custom refresh callback
tokenManager.onRefreshNeeded(async () => {
  try {
    // Your custom refresh logic here
    const newToken = await refreshTokenFromApi();
    tokenManager.updateTokenInfo({
      token: newToken.accessToken,
      expiresAt: newToken.expiresAt,
    });
    return true; // Refresh succeeded
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return false; // Refresh failed
  }
});

// Force refresh the token
await tokenManager.forceRefresh(user);

// Reset the token manager
tokenManager.reset();
```

### NetworkManager

NetworkManager monitors network connectivity with enhanced detection capabilities.

```typescript
import { NetworkManager, getNetworkManager } from '@donotdev/utils';

// Option 1: Create a new instance with custom configuration
const networkManager = new NetworkManager({
  pingEndpoint: 'https://your-api.com/heartbeat',
  pingTimeout: 3000,
  checkInterval: 60000,
  debounceTime: 500,
});

// Option 2: Use the singleton instance (recommended)
const networkManager = getNetworkManager();

// Get the current network status
const status = networkManager.getStatus();
console.log('Online:', status.online);
console.log('Connection type:', status.connectionType);
console.log('Effective type:', status.effectiveType);

// Observe network status changes
networkManager.observeStatus().subscribe((status) => {
  console.log('Network status changed:', status);
});

// Register a callback for when network reconnects
const unsubscribe = networkManager.onReconnect(() => {
  console.log('Network reconnected!');
  // Refresh data, retry failed operations, etc.
});

// Manually check connectivity
const isOnline = await networkManager.checkConnectivity();
console.log('Online status:', isOnline);

// Unsubscribe from reconnect events
unsubscribe();

// Clean up resources when done
networkManager.destroy();
```

### Error Handling

The package provides a comprehensive error handling system with standardized error codes and a consistent approach to error management.

#### DoNotDevError

```typescript
import { DoNotDevError } from '@donotdev/utils';
import type { ErrorCode } from '@donotdev/types';

// Create a custom error
const error = new DoNotDevError(
  'User profile could not be updated',
  'permission-denied',
  { userId: '123', attempted: 'profile_update' }
);

console.log(error.code); // 'permission-denied'
console.log(error.message); // 'User profile could not be updated'
console.log(error.details); // { userId: '123', attempted: 'profile_update' }

// Convert to string
console.log(error.toString()); // 'DoNotDevError [permission-denied]: User profile could not be updated'

// Convert to JSON for logging
console.log(error.toJSON());
```

#### Service Error Handler

```typescript
import {
  createServiceErrorHandler,
  commonErrorCodeMappings,
} from '@donotdev/utils';

// Create a custom error handler for a specific service
const handleFirebaseError = createServiceErrorHandler({
  errorCodeMapping: {
    'auth/user-not-found': 'not-found',
    'auth/wrong-password': 'unauthenticated',
    'auth/too-many-requests': 'rate-limit-exceeded',
    ...commonErrorCodeMappings, // Include common mappings
  },
  friendlyMessageMapping: {
    'auth/user-not-found':
      'User account not found. Please check your email or sign up.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
  },
  defaultErrorCode: 'unknown',
  defaultErrorMessage: 'An error occurred with authentication.',
});

// Use the error handler
try {
  await signInWithEmailAndPassword(auth, email, password);
} catch (error) {
  // Converts Firebase error to DoNotDevError with standardized code and friendly message
  const standardError = handleFirebaseError(error);

  // Now you can handle the standardized error
  console.error(standardError.toString());

  // Or throw it to be caught by a higher-level handler
  throw standardError;
}
```

#### Global Error Handler

```typescript
import { handleError } from '@donotdev/utils';

// In Firebase Cloud Functions or similar environment
try {
  // Your function logic
} catch (error) {
  // Converts any error to an HttpsError with appropriate code
  return handleError(error);
}
```

## 🚨 Error Handling Strategy

The DoNotDev framework uses a multi-level approach to error handling:

### 1. Error Creation

Use the `DoNotDevError` class for all application-specific errors:

```typescript
throw new DoNotDevError('Operation failed', 'permission-denied', {
  contextData,
});
```

### 2. Error Conversion

Convert external service errors to DoNotDevError using service-specific handlers:

```typescript
import { createServiceErrorHandler } from '@donotdev/utils';

const handleStripeError = createServiceErrorHandler({
  errorCodeMapping: {
    'card_declined': 'payment-failed',
    'invalid_card_number': 'invalid-argument'
  },
  friendlyMessageMapping: {
    'card_declined': 'Your card was declined. Please try another payment method.'
  }
});

try {
  await stripeClient.charges.create({...});
} catch (error) {
  throw handleStripeError(error);
}
```

### 3. Error Handling Hierarchy

1. **Component Level**: Handle and display user-friendly errors in UI components
2. **Service Level**: Convert and standardize errors from external services
3. **Global Level**: Catch unhandled errors and report to monitoring services

### 4. Centralizing Error Management

To simplify error handling across your application, consider using a centralized error store:

```typescript
// Example usage with direct toast calls
import { toast } from '@donotdev/components';

try {
  await userService.updateProfile(data);
} catch (error) {
  // Show toast notification directly
  toast('error', 'Profile update failed');
}
```

### 5. Error Codes Standardization

Use consistent error codes from the `ErrorCode` type in `@donotdev/types`:

## 🤔 Troubleshooting

### Multiple Error Handlers

If you're confused about the multiple error handling mechanisms, here's a guide on when to use each:

1. **DoNotDevError**: Use for creating application-specific errors with standardized codes
2. **createServiceErrorHandler**: Use for converting external service errors to DoNotDevError
3. **handleError**: Use at the global level to convert any error to an HttpsError (for Firebase Functions)
4. **ErrorStore/useError hooks**: Use for managing and displaying errors in the UI (not part of @donotdev/utils)

Recommended approach:

- Services should convert external errors to DoNotDevError
- Components should capture and display these errors using hooks or state
- Global handlers should catch and log unhandled errors

### Network and Token Management

For best results:

- Use the singleton instance of NetworkManager via `getNetworkManager()`
- Initialize TokenManager early in your application lifecycle
- Listen for network reconnections to trigger token validation and data refresh

## 🐛 Debugging

Enable detailed logging in development mode:

```typescript
import { setDebugLevel } from '@donotdev/utils';

// Set debug level in development
if (process.env.NODE_ENV === 'development') {
  setDebugLevel('verbose');
}
```

## 🙋‍♂️ Contributing

This is a proprietary package. Please contact Ambroise Park Consulting for information about contributions.

## 📄 License & Ownership

All rights reserved.  
The DoNotDev framework and its premium features are the exclusive property of **Ambroise Park Consulting**.

- Licensed under MIT. See LICENSE.md.

© Ambroise Park Consulting – 2025
