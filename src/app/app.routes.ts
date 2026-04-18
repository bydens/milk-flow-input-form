import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'form1', pathMatch: 'full' },
  {
    path: 'form1',
    loadComponent: () =>
      import('./feedback-form/feedback-form.component').then(m => m.FeedbackFormComponent),
  },
  {
    path: 'form2',
    loadComponent: () =>
      import('./brew-protocol-form/brew-protocol-form.component').then(
        m => m.BrewProtocolFormComponent,
      ),
  },
];
