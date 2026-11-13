import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock(
  'react-native-gesture-handler/src/v3/detectors/useEnsureGestureHandlerRootView',
  () => ({
    useEnsureGestureHandlerRootView: () => {},
  })
);
jest.mock(
  'react-native-gesture-handler/lib/module/v3/detectors/useEnsureGestureHandlerRootView',
  () => ({
    useEnsureGestureHandlerRootView: () => {},
  })
);
jest.mock('react-native-worklets', () => {
  const NOOP = () => {};
  const ID = <T>(v: T): T => v;
  return {
    __esModule: true,
    isWorkletRuntime: () => false,
    scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
      fn(...args);
    },
    scheduleOnUI: NOOP,
    runOnJS: <Args extends unknown[], R>(fn: (...args: Args) => R) => fn,
    runOnUI: <Args extends unknown[], R>(fn: (...args: Args) => R) => fn,
    runOnUISync: ID,
    makeShareable: ID,
    makeShareableCloneRecursive: ID,
  };
});

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Lightweight mock for expo-router Stack and navigation primitives
const mockStackScreen = () => null;
const mockStack = Object.assign(
  ({ children }: { children?: React.ReactNode }) => children ?? null,
  { Screen: mockStackScreen }
);
jest.mock('expo-router', () => ({
  Stack: mockStack,
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

// Lightweight, type-safe unit test mock for react-native-reanimated UI-thread primitives
const { View: mockView } = jest.requireActual<typeof import('react-native')>('react-native');
const mockCreateAnimatedComponent = <T>(comp: T): T => comp;
const NOOP = () => {};

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: mockView,
    createAnimatedComponent: mockCreateAnimatedComponent,
    isSharedValue: (value: unknown): boolean =>
      typeof value === 'object' && value !== null && 'value' in value,
  },
  createAnimatedComponent: mockCreateAnimatedComponent,
  isSharedValue: (value: unknown): boolean =>
    typeof value === 'object' && value !== null && 'value' in value,
  useSharedValue: <T>(initialValue: T) => ({
    value: initialValue,
    addListener: () => {},
    removeListener: () => {},
    modify: (modifier?: (value: T) => T) => {
      if (modifier) modifier(initialValue);
    },
  }),
  useAnimatedStyle: <T extends Record<string, unknown>>(fn: () => T): T => fn(),
  useAnimatedRef: () => ({ current: null }),
  useEvent: () => jest.fn(),
  useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
  runOnJS: <Args extends unknown[], R>(fn: (...args: Args) => R) => fn,
  runOnUI: <Args extends unknown[], R>(fn: (...args: Args) => R) => fn,
  withTiming: <T>(toValue: T): T => toValue,
  withSpring: <T>(toValue: T): T => toValue,
  cancelAnimation: NOOP,
  interpolateColor: (
    _val: number,
    _inputRange: readonly number[],
    outputRange: readonly string[]
  ): string => outputRange[1] ?? outputRange[0] ?? 'transparent',
}));
