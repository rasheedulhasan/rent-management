import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    return this.checkAuth(route);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    return this.checkAuth(childRoute);
  }

  private checkAuth(route: ActivatedRouteSnapshot): boolean | UrlTree {
    // Check if user is logged in
    if (!this.authService.isLoggedIn()) {
      // Redirect to login page with return URL
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: route.pathFromRoot.map(r => r.url.join('/')).filter(Boolean).join('/') || '/dashboard' }
      });
    }

    // Check if admin role is required
    const requiredRole = route.data['role'] || 'admin';
    if (requiredRole === 'admin' && !this.authService.isAdmin()) {
      // User is logged in but not admin - redirect to login
      this.authService.logout();
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: route.pathFromRoot.map(r => r.url.join('/')).filter(Boolean).join('/') || '/dashboard' }
      });
    }

    return true;
  }
}
