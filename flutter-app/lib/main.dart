import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'navigation/app_routes.dart';
import 'providers/tenant_detail_provider.dart';
import 'providers/tenant_list_provider.dart';
import 'screens/tenant_list_screen.dart';
import 'services/api_client.dart';

void main() {
  // Initialize the API client with the backend base URL.
  // Production: https://seashell-app-ydu9s.ondigitalocean.app/api
  // Override at build time: --dart-define=API_BASE_URL=<url>
  ApiClient.init(
    baseUrl: const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'https://seashell-app-ydu9s.ondigitalocean.app/api',
    ),
  );

  runApp(const RentManagementApp());
}

class RentManagementApp extends StatelessWidget {
  const RentManagementApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TenantDetailProvider()),
        ChangeNotifierProvider(create: (_) => TenantListProvider()),
      ],
      child: MaterialApp(
        title: 'Rent Management',
        debugShowCheckedModeBanner: false,
        theme: _buildTheme(),
        initialRoute: '/',
        onGenerateRoute: AppRoutes.generateRoute,
        home: const TenantListScreen(),
      ),
    );
  }

  ThemeData _buildTheme() {
    const seedColor = Color(0xFF1A237E);
    return ThemeData(
      useMaterial3: true,
      colorSchemeSeed: seedColor,
      brightness: Brightness.light,
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.grey.shade200),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}
