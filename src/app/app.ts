import { Component, signal } from '@angular/core';
import { FeedbackFormComponent } from './feedback-form/feedback-form.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FeedbackFormComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('milk-flow-input-form');
}
