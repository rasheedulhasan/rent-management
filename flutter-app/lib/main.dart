import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'navigation/app_routes.dart';
import 'providers/tenant_detail_provider.dart';
import 'services/api_client.dart';

void main() {
  // Initialize the API client with the backend base URL.
  // For Android emulator: http://10.0.2.2:3001/api
  // For iOS simulator:    http://localhost:3001/api
  // For physical device:  Use your machine's local IP address
  ApiClient.init(
    baseUrl: const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:3001/api',
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
        ChangeNotifierProvider(
          create: (_) => TenantDetailProvider(),
        ),
        // Add other providers here as needed, e.g.:
        // ChangeNotifierProvider(create: (_) => TenantListProvider()),
        // ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: MaterialApp(
        title: 'Rent Management',
        debugShowCheckedModeBanner: false,
        theme: _buildTheme(),
        // Routes
        initialRoute: '/',
        onGenerateRoute: AppRoutes.generateRoute,
        // Fallback home — replace with actual home screen
        home: Scaffold(
          backgroundColor: const Color(0xFFF5F7FA),
          appBar: AppBar(
            title: const Text('Tenants'),
            backgroundColor: const Color(0xFF1A237E),
            foregroundColor: Colors.white,
          ),
          body: const Center(
            child: Text(
              'Tenant list will go here.\n\n'
              'Navigate to tenant detail:\n'
              'AppRoutes.navigateToTenantDetail(\n'
              '  context,\n'
              '  tenantId: "YOUR_TENANT_ID",\n'
              ');\n',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ),
        ),
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
