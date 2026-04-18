import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

type View = 'form' | 'confirm';

interface FeedbackData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface SubmitError {
  status: number;
  statusText: string;
  message: string;
}

const STORAGE_KEY = 'feedbackFormData';

@Component({
  selector: 'app-feedback-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './feedback-form.component.html',
  styleUrls: ['./feedback-form.component.scss']
})
export class FeedbackFormComponent implements OnInit {
  feedbackForm: FormGroup;
  view: View = 'form';
  isSubmitting = false;
  isSuccess = false;
  submitError: SubmitError | null = null;

  readonly subjectLabels: Record<string, string> = {
    support: 'Техподдержка',
    sales: 'Отдел продаж',
    other: 'Другое'
  };

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.feedbackForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit(): void {
    const saved = this.loadFromStorage();
    if (saved) {
      this.feedbackForm.patchValue(saved);
    }
  }

  isFieldInvalid(field: string): boolean {
    const control = this.feedbackForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  get formData(): FeedbackData {
    return this.feedbackForm.value as FeedbackData;
  }

  subjectLabel(value: string): string {
    return this.subjectLabels[value] ?? value;
  }

  onReview(): void {
    if (this.feedbackForm.valid) {
      this.submitError = null;
      this.view = 'confirm';
    } else {
      this.feedbackForm.markAllAsTouched();
    }
  }

  onEdit(): void {
    this.submitError = null;
    this.view = 'form';
  }

  onCancel(): void {
    this.feedbackForm.reset();
    this.clearStorage();
    this.submitError = null;
    this.view = 'form';
  }

  onSubmit(): void {
    if (this.feedbackForm.invalid || this.isSubmitting) {
      return;
    }

    const payload = this.formData;
    this.saveToStorage(payload);
    this.isSubmitting = true;
    this.submitError = null;

    this.http.post(environment.n8nWebhookUrl, payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.clearStorage();
        this.feedbackForm.reset();
        this.view = 'form';
        this.isSuccess = true;
        setTimeout(() => (this.isSuccess = false), 5000);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.submitError = this.toSubmitError(err);
      }
    });
  }

  private toSubmitError(err: HttpErrorResponse): SubmitError {
    const status = err.status ?? 0;
    const statusText = err.statusText || 'Error';
    let message: string;

    const body = err.error;
    if (typeof body === 'string' && body.trim()) {
      message = body;
    } else if (body && typeof body === 'object') {
      message = body.message || body.error || JSON.stringify(body);
    } else if (err.message) {
      message = err.message;
    } else {
      message = 'Неизвестная ошибка при отправке данных.';
    }

    return { status, statusText, message };
  }

  private saveToStorage(data: FeedbackData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore storage failures (quota, private mode, etc.)
    }
  }

  private loadFromStorage(): FeedbackData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as FeedbackData) : null;
    } catch {
      return null;
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
