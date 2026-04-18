import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-feedback-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './feedback-form.component.html',
  styleUrls: ['./feedback-form.component.scss']
})
export class FeedbackFormComponent {
  feedbackForm: FormGroup;
  isSubmitting = false;
  isSuccess = false;
  errorMessage = '';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.feedbackForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.feedbackForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.feedbackForm.valid) {
      this.isSubmitting = true;
      this.errorMessage = '';
      const formData = this.feedbackForm.value;

      console.log('Данные формы для отправки:', JSON.stringify(formData, null, 2));

      this.http.post(environment.n8nWebhookUrl, formData).subscribe({
        next: (response) => {
          console.log('Успешно отправлено:', response);
          this.isSubmitting = false;
          this.isSuccess = true;
          this.feedbackForm.reset();
          
          setTimeout(() => this.isSuccess = false, 3000);
        },
        error: (error) => {
          console.error('Ошибка при отправке:', error);
          this.errorMessage = 'Произошла ошибка при отправке данных. Пожалуйста, попробуйте позже.';
          this.isSubmitting = false;
        }
      });
    } else {
      this.feedbackForm.markAllAsTouched();
    }
  }
}
