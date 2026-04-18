import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

type View = 'form' | 'confirm';

interface IdentificationFormData {
  date: string;          // YYYY-MM-DD (native date input)
  startTime: string;     // HH:MM
  brewNumber: string;    // e.g. W33
  stretchMachineNumber: string; // "1" | "2"
  productBatchNumber: string | number; // number, stored as string from input
  grainBatchNumber: string; // e.g. W33.1
  operator: string;
  comments: string;
}

interface IdentificationPayload {
  id: string;                    // date + time + brewNumber
  submittedAt: string;           // ISO timestamp
  date: string;                  // DD.MM.YYYY
  startTime: string;             // HH:MM
  brewNumber: string;
  stretchMachineNumber: string;
  productBatchNumber: number;
  grainBatchNumber: string;
  operator: string;
  comments: string;
}

interface SubmitError {
  status: number;
  statusText: string;
  message: string;
}

const STORAGE_KEY = 'identificationFormData';

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

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.feedbackForm = this.fb.group({
      date: ['', [Validators.required]],
      startTime: ['', [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]],
      brewNumber: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]],
      stretchMachineNumber: ['', [Validators.required]],
      productBatchNumber: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1)]],
      grainBatchNumber: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]],
      operator: ['', [Validators.required, Validators.minLength(2)]],
      comments: ['']
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

  get formData(): IdentificationFormData {
    return this.feedbackForm.value as IdentificationFormData;
  }

  get previewPayload(): IdentificationPayload {
    return this.buildPayload(this.formData);
  }

  get stretchMachineLabel(): string {
    const value = this.formData.stretchMachineNumber;
    return value ? `№ ${value}` : '';
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
    this.feedbackForm.reset({
      date: '',
      startTime: '',
      brewNumber: '',
      stretchMachineNumber: '',
      productBatchNumber: '',
      grainBatchNumber: '',
      operator: '',
      comments: ''
    });
    this.clearStorage();
    this.submitError = null;
    this.view = 'form';
  }

  onSubmit(): void {
    if (this.feedbackForm.invalid || this.isSubmitting) {
      return;
    }

    const data = this.formData;
    this.saveToStorage(data);
    const payload = this.buildPayload(data);
    this.isSubmitting = true;
    this.submitError = null;

    this.http.post(environment.n8nWebhookUrl, payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.clearStorage();
        this.feedbackForm.reset({
          date: '',
          startTime: '',
          brewNumber: '',
          stretchMachineNumber: '',
          productBatchNumber: '',
          grainBatchNumber: '',
          operator: '',
          comments: ''
        });
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

  private buildPayload(data: IdentificationFormData): IdentificationPayload {
    const formattedDate = this.toDisplayDate(data.date);
    const brewNumber = (data.brewNumber || '').trim();
    return {
      id: `${formattedDate}_${data.startTime}_${brewNumber}`,
      submittedAt: new Date().toISOString(),
      date: formattedDate,
      startTime: data.startTime,
      brewNumber,
      stretchMachineNumber: data.stretchMachineNumber,
      productBatchNumber: Number(data.productBatchNumber),
      grainBatchNumber: (data.grainBatchNumber || '').trim(),
      operator: (data.operator || '').trim(),
      comments: (data.comments || '').trim()
    };
  }

  private toDisplayDate(isoDate: string): string {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return isoDate;
    }
    const [y, m, d] = isoDate.split('-');
    return `${d}.${m}.${y}`;
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

  private saveToStorage(data: IdentificationFormData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore storage failures (quota, private mode, etc.)
    }
  }

  private loadFromStorage(): IdentificationFormData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as IdentificationFormData;
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
