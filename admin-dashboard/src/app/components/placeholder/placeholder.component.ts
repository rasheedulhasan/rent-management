import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="placeholder-page">
      <mat-card class="placeholder-card">
        <div class="card-content">
          <mat-icon class="placeholder-icon">{{ icon }}</mat-icon>
          <h2>{{ title }} Page</h2>
          <p>This page is under construction. It will be implemented soon.</p>
          <p class="hint">Feature coming in the next update</p>
        </div>
      </mat-card>
      
      <div class="placeholder-info">
        <h3>What to expect:</h3>
        <ul>
          <li>Complete data management interface</li>
          <li>Advanced filtering and search</li>
          <li>Real-time updates</li>
          <li>Export functionality</li>
          <li>Detailed analytics</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-page {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .placeholder-card {
      text-align: center;
      padding: 3rem 2rem;
      margin-bottom: 2rem;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }
    
    .card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .placeholder-icon {
      font-size: 64px;
      height: 64px;
      width: 64px;
      color: #1a237e;
      margin-bottom: 1.5rem;
    }
    
    h2 {
      color: #1a237e;
      margin: 0 0 1rem 0;
      font-size: 2rem;
    }
    
    p {
      color: #666;
      font-size: 1.1rem;
      margin: 0.5rem 0;
    }
    
    .hint {
      font-size: 0.9rem;
      color: #888;
      font-style: italic;
    }
    
    .placeholder-info {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h3 {
      color: #333;
      margin-top: 0;
    }
    
    ul {
      padding-left: 1.5rem;
      color: #555;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
  `]
})
export class PlaceholderComponent {
  title = 'Placeholder';
  icon = 'construction';

  constructor(private route: ActivatedRoute) {
    this.route.data.subscribe(data => {
      this.title = data['title'] || 'Placeholder';
      this.icon = data['icon'] || 'construction';
    });
  }
}