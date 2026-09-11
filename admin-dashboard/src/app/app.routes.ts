import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AlertsComponent } from './components/alerts/alerts.component';
import { AuthGuard } from './guards/auth.guard';

// Placeholder components
const PlaceholderComponent = () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent);
const TenantsComponent = () => import('./components/tenants/tenants.component').then(m => m.TenantsComponent);
const BuildingsComponent = () => import('./components/buildings/buildings.component').then(m => m.BuildingsComponent);
const UsersComponent = () => import('./components/users/users.component').then(m => m.UsersComponent);
const LoginComponent = () => import('./components/login/login.component').then(m => m.LoginComponent);
const PendingRentComponent = () => import('./components/pending-rent/pending-rent.component').then(m => m.PendingRentComponent);
const TransactionsComponent = () => import('./components/transactions/transactions.component').then(m => m.TransactionsComponent);

// Form pages (separate routes instead of modals)
const AddBuildingComponent = () => import('./components/buildings/add-building/add-building.component').then(m => m.AddBuildingComponent);
const AddTenantComponent = () => import('./components/tenants/add-tenant/add-tenant.component').then(m => m.AddTenantComponent);
const AddUserComponent = () => import('./components/users/add-user/add-user.component').then(m => m.AddUserComponent);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: LoginComponent,
    title: 'Login - Rent Management'
  },
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: { role: 'admin' },
    title: 'Dashboard - Rent Management'
  },
  {
    path: 'transactions',
    loadComponent: TransactionsComponent,
    canActivate: [AuthGuard],
    data: { title: 'Transactions', icon: 'receipt', role: 'admin' },
    title: 'Transactions - Rent Management'
  },
  {
    path: 'pending-rent',
    loadComponent: PendingRentComponent,
    canActivate: [AuthGuard],
    data: { title: 'Pending Rent', icon: 'pending_actions', role: 'admin' },
    title: 'Pending Rent - Rent Management'
  },
  {
    path: 'tenants',
    loadComponent: TenantsComponent,
    canActivate: [AuthGuard],
    data: { title: 'Tenants', icon: 'people', role: 'admin' },
    title: 'Tenants - Rent Management'
  },
  {
    path: 'tenants/add',
    loadComponent: AddTenantComponent,
    canActivate: [AuthGuard],
    data: { title: 'Add Tenant', role: 'admin' },
    title: 'Add Tenant - Rent Management'
  },
  {
    path: 'buildings',
    loadComponent: BuildingsComponent,
    canActivate: [AuthGuard],
    data: { title: 'Buildings', icon: 'business', role: 'admin' },
    title: 'Buildings - Rent Management'
  },
  {
    path: 'buildings/add',
    loadComponent: AddBuildingComponent,
    canActivate: [AuthGuard],
    data: { title: 'Add Building', role: 'admin' },
    title: 'Add Building - Rent Management'
  },
  {
    path: 'users',
    loadComponent: UsersComponent,
    canActivate: [AuthGuard],
    data: { title: 'Users', icon: 'supervisor_account', role: 'admin' },
    title: 'Users - Rent Management'
  },
  {
    path: 'users/add',
    loadComponent: AddUserComponent,
    canActivate: [AuthGuard],
    data: { title: 'Add User', role: 'admin' },
    title: 'Add User - Rent Management'
  },
  {
    path: 'alerts',
    component: AlertsComponent,
    canActivate: [AuthGuard],
    data: { title: 'Alerts', icon: 'notifications', role: 'admin' },
    title: 'Alerts - Rent Management'
  },
  {
    path: 'reports',
    loadComponent: PlaceholderComponent,
    canActivate: [AuthGuard],
    data: { title: 'Reports', icon: 'assessment', role: 'admin' },
    title: 'Reports - Rent Management'
  },
  {
    path: 'settings',
    loadComponent: PlaceholderComponent,
    canActivate: [AuthGuard],
    data: { title: 'Settings', icon: 'settings', role: 'admin' },
    title: 'Settings - Rent Management'
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
