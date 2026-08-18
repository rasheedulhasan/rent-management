import 'package:flutter/material.dart';
import '../providers/tenant_detail_provider.dart';
import '../screens/tenant_detail_screen.dart';

/// Centralized route names for the app.
class AppRoutes {
  AppRoutes._();

  static const String tenantDetail = '/tenant-detail';

  /// Generate routes. Call with the app's [RouteSettings].
  static Route<dynamic>? generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case tenantDetail:
        final args = settings.arguments as Map<String, dynamic>;
        final tenantId = args['tenantId'] as String;
        return MaterialPageRoute(
          builder: (_) => TenantDetailScreen(tenantId: tenantId),
          settings: settings,
        );
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(
              child: Text('No route defined for ${settings.name}'),
            ),
          ),
          settings: settings,
        );
    }
  }

  /// Convenience method to navigate to tenant detail from any context.
  static Future<void> navigateToTenantDetail(
    BuildContext context, {
    required String tenantId,
  }) {
    return Navigator.pushNamed(
      context,
      tenantDetail,
      arguments: {'tenantId': tenantId},
    );
  }
}
