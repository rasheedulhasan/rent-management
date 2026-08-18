import 'dart:io' show Platform;
import 'package:dio/dio.dart';

/// Singleton API client for communicating with the backend.
///
/// Automatically detects the platform to use the correct base URL:
///   - Android emulator: http://10.0.2.2:3001/api
///   - iOS simulator:    http://localhost:3001/api
///   - Web / other:      http://localhost:3001/api
///
/// Override with [init] for production builds or custom configurations.
class ApiClient {
  static ApiClient? _instance;
  late final Dio _dio;

  ApiClient._internal({String? baseUrl}) {
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl ?? _defaultBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
        error: true,
        logPrint: (obj) => print('[API] $obj'),
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onError: (error, handler) {
          if (error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.receiveTimeout ||
              error.type == DioExceptionType.sendTimeout) {
            print('[API] Request timed out: ${error.requestOptions.path}');
          } else if (error.type == DioExceptionType.connectionError) {
            print(
                '[API] Connection error: ${error.requestOptions.path} — check if server is running');
          }
          handler.next(error);
        },
      ),
    );
  }

  /// Initialize the API client singleton with an optional custom base URL.
  static void init({String? baseUrl}) {
    _instance = ApiClient._internal(baseUrl: baseUrl);
  }

  /// Access the singleton instance. Call [init] first.
  static ApiClient get instance {
    _instance ??= ApiClient._internal();
    return _instance!;
  }

  /// The underlying Dio instance for direct use.
  Dio get dio => _dio;

  /// Automatically picks the correct base URL per platform.
  ///
  /// Android emulator uses 10.0.2.2 to reach the host machine's localhost.
  /// iOS simulator and web use localhost directly.
  ///
  /// On a physical device, use the machine's local IP address instead,
  /// passed via [init] or the `API_BASE_URL` environment variable.
  static String get _defaultBaseUrl {
    // Note: On physical devices, set the base URL explicitly via
    // ApiClient.init(baseUrl: 'http://<YOUR_IP>:3001/api')
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:3001/api';
      }
    } catch (_) {
      // Platform not available (web or test environment)
    }
    return 'http://localhost:3001/api';
  }

  /// Convenience GET with structured response parsing.
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.get(
      path,
      queryParameters: queryParameters,
      options: options,
    );
  }

  /// Convenience POST with structured response parsing.
  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return _dio.post(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }
}
