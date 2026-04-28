import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AlertsComponent } from './components/alerts/alerts.component';

// Placeholder components
const PlaceholderComponent = () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent);
const TenantsComponent = () => import('./components/tenants/tenants.component').then(m => m.TenantsComponent);
const BuildingsComponent = () => import('./components/buildings/buildings.component').then(m => m.BuildingsComponent);
const UsersComponent = () => import('./components/users/users.component').then(m => m.UsersComponent);

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    title: 'Dashboard - Rent Management'
  },
  {
    path: 'transactions',
    loadComponent: PlaceholderComponent,
    data: { title: 'Transactions', icon: 'receipt' },
    title: 'Transactions - Rent Management'
  },
  {
    path: 'pending-rent',
    loadComponent: PlaceholderComponent,
    data: { title: 'Pending Rent', icon: 'pending_actions' },
    title: 'Pending Rent - Rent Management'
  },
  {
    path: 'tenants',
    loadComponent: TenantsComponent,
    data: { title: 'Tenants', icon: 'people' },
    title: 'Tenants - Rent Management'
  },
  {
    path: 'buildings',
    loadComponent: BuildingsComponent,
    data: { title: 'Buildings', icon: 'business' },
    title: 'Buildings - Rent Management'
  },
  {
    path: 'users',
    loadComponent: UsersComponent,
    data: { title: 'Users', icon: 'supervisor_account' },
    title: 'Users - Rent Management'
  },
  {
    path: 'alerts',
    component: AlertsComponent,
    data: { title: 'Alerts', icon: 'notifications' },
    title: 'Alerts - Rent Management'
  },
  {
    path: 'reports',
    loadComponent: PlaceholderComponent,
    data: { title: 'Reports', icon: 'assessment' },
    title: 'Reports - Rent Management'
  },
  {
    path: 'settings',
    loadComponent: PlaceholderComponent,
    data: { title: 'Settings', icon: 'settings' },
    title: 'Settings - Rent Management'
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
