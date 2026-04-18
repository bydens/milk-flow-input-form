import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

type View = 'form' | 'confirm';

interface SubmitError {
  status: number;
  statusText: string;
  message: string;
}

const STORAGE_KEY = 'brewProtocolFormData';

/** Field group definition for template rendering */
interface FieldGroup {
  title: string;
  columns: number;
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  unit: string;
  type: 'number' | 'text' | 'time' | 'textarea';
  placeholder?: string;
  required?: boolean;
  max?: number;
  readonly?: boolean;
}

@Component({
  selector: 'app-brew-protocol-form',
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './brew-protocol-form.component.html',
  styleUrls: ['./brew-protocol-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrewProtocolFormComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  view = signal<View>('form');
  isSubmitting = signal(false);
  isSuccess = signal(false);
  submitError = signal<SubmitError | null>(null);

  /** Reactive form with all fields */
  form = this.fb.group({
    // 2. ВХОД: ЗЕРНО
    grainQuantity: [null as number | null, [Validators.required, Validators.min(0)]],
    cagliataFat: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    grainPH: [null as number | null],
    grainMoisture: [null as number | null, [Validators.min(0), Validators.max(100)]],

    // 3. ВОЗВРАТ ИЗ ФАСОВКИ
    returnBrewNumber: [''],
    returnMass: [null as number | null, [Validators.min(0)]],

    // 4. МЁРТВЫЙ ОСТАТОК
    deadRemainOnLoad: [null as number | null, [Validators.min(0), Validators.max(5)]],

    // 5. СОЛЬ
    salt: [null as number | null, [Validators.min(0)]],

    // 6. ПЛАВИТЕЛИ
    melter1Name: [''],
    melter1Qty: [null as number | null, [Validators.min(0)]],
    melter2Name: [''],
    melter2Qty: [null as number | null, [Validators.min(0)]],
    melter3Name: [''],
    melter3Qty: [null as number | null, [Validators.min(0)]],

    // 7. ПРОЧИЕ ИНГРЕДИЕНТЫ
    starch: [null as number | null, [Validators.min(0)]],
    preservativeName: [''],
    preservativeQty: [null as number | null, [Validators.min(0)]],
    fatOil: [null as number | null, [Validators.min(0)]],

    // 8. ВОДА
    waterDirect: [null as number | null, [Validators.min(0)]],
    steam: [null as number | null, [Validators.min(0)]],

    // 9. ТЕМПЕРАТУРА
    tempAfterLoad: [null as number | null],
    maxTempHeat: [null as number | null, [Validators.max(74)]],
    tempBeforeRelease: [null as number | null],

    // 10. МАССА В КОТЛЕ
    massAfterLoad: [null as number | null, [Validators.min(0)]],
    massBeforeRelease: [null as number | null, [Validators.min(0)]],
    massReleased: [null as number | null, [Validators.min(0)]],

    // 11. ТЕХНОЛ. ОСТАТКИ ПОСЛЕ ВЫПУСКА
    deadRemainAfterRelease: [null as number | null, [Validators.min(0), Validators.max(5)]],
    cleanedFromPacking: [null as number | null, [Validators.min(0)]],

    // 12. ДЛИТЕЛЬНОСТЬ
    brewDuration: [null as number | null, [Validators.min(0)]],

    // 13. ФОРМЫ
    filledFormsCount: [null as number | null, [Validators.min(0)]],

    // 14. ОХЛАЖДЕНИЕ
    containerLoadTime: ['', [Validators.pattern(/^\d{2}:\d{2}$/)]],
    containerNumber: [''],
    waterCoolRemoveTime: ['', [Validators.pattern(/^\d{2}:\d{2}$/)]],
    actualBlocksCount: [null as number | null, [Validators.min(0)]],

    // 15. УПАКОВКА
    packagingType: [''],

    // 16. ПРИМЕЧАНИЯ
    notes: [''],
    operatorSignature: ['', [Validators.required, Validators.minLength(2)]],
  });

  /** Auto-computed: total input mass */
  totalInputMass = computed(() => {
    const v = this.form.value;
    return (
      (v.grainQuantity || 0) +
      (v.returnMass || 0) +
      (v.salt || 0) +
      (v.melter1Qty || 0) +
      (v.melter2Qty || 0) +
      (v.melter3Qty || 0) +
      (v.starch || 0) +
      (v.preservativeQty || 0) +
      (v.fatOil || 0) +
      (v.waterDirect || 0) +
      (v.steam || 0)
    );
  });

  /** Auto-computed: output percent */
  outputPercent = computed(() => {
    const total = this.totalInputMass();
    const released = this.form.value.massReleased || 0;
    if (total === 0) return 0;
    return Math.round((released / total) * 10000) / 100; // 2 decimals
  });

  /** Field groups for template rendering */
  fieldGroups: FieldGroup[] = [
    {
      title: '2. ВХОД: ЗЕРНО',
      columns: 2,
      fields: [
        { key: 'grainQuantity', label: 'Кол-во зерна', unit: 'kg', type: 'number', required: true },
        { key: 'cagliataFat', label: 'Жирность cagliata', unit: '%', type: 'number', required: true },
        { key: 'grainPH', label: 'pH зерна', unit: '—', type: 'number' },
        { key: 'grainMoisture', label: 'Влажность зерна', unit: '%', type: 'number' },
      ],
    },
    {
      title: '3. ВОЗВРАТ ИЗ ФАСОВКИ',
      columns: 2,
      fields: [
        { key: 'returnBrewNumber', label: 'Возврат: № варки-источника', unit: '—', type: 'text' },
        { key: 'returnMass', label: 'Возврат: масса', unit: 'kg', type: 'number' },
      ],
    },
    {
      title: '4. МЁРТВЫЙ ОСТАТОК',
      columns: 1,
      fields: [
        { key: 'deadRemainOnLoad', label: 'Мёртвый ост. на загрузке', unit: 'kg (≤5)', type: 'number' },
      ],
    },
    {
      title: '5. СОЛЬ',
      columns: 1,
      fields: [
        { key: 'salt', label: 'NaCl', unit: 'kg', type: 'number' },
      ],
    },
    {
      title: '6. ПЛАВИТЕЛИ',
      columns: 2,
      fields: [
        { key: 'melter1Name', label: 'Плавитель-1: наим.', unit: '—', type: 'text' },
        { key: 'melter1Qty', label: 'Плавитель-1: кол-во', unit: 'kg', type: 'number' },
        { key: 'melter2Name', label: 'Плавитель-2: наим.', unit: '—', type: 'text' },
        { key: 'melter2Qty', label: 'Плавитель-2: кол-во', unit: 'kg', type: 'number' },
        { key: 'melter3Name', label: 'Плавитель-3: наим.', unit: '—', type: 'text' },
        { key: 'melter3Qty', label: 'Плавитель-3: кол-во', unit: 'kg', type: 'number' },
      ],
    },
    {
      title: '7. ПРОЧИЕ ИНГРЕДИЕНТЫ',
      columns: 2,
      fields: [
        { key: 'starch', label: 'Крахмал', unit: 'kg', type: 'number' },
        { key: 'fatOil', label: 'Жир / Олей', unit: 'kg', type: 'number' },
        { key: 'preservativeName', label: 'Консервант: наим.', unit: '—', type: 'text' },
        { key: 'preservativeQty', label: 'Консервант: кол-во', unit: 'kg', type: 'number' },
      ],
    },
    {
      title: '8. ВОДА',
      columns: 2,
      fields: [
        { key: 'waterDirect', label: 'Вода прямой залив', unit: 'kg', type: 'number' },
        { key: 'steam', label: 'Пар', unit: 'kg', type: 'number' },
      ],
    },
    {
      title: '9. ТЕМПЕРАТУРА',
      columns: 3,
      fields: [
        { key: 'tempAfterLoad', label: 'T массы после загрузки', unit: '°C', type: 'number' },
        { key: 'maxTempHeat', label: 'Макс T при нагреве', unit: '°C (≤74)', type: 'number' },
        { key: 'tempBeforeRelease', label: 'T массы перед выпуском', unit: '°C', type: 'number' },
      ],
    },
    {
      title: '10. МАССА В КОТЛЕ',
      columns: 3,
      fields: [
        { key: 'massAfterLoad', label: 'Масса после загрузки', unit: 'kg', type: 'number' },
        { key: 'massBeforeRelease', label: 'Масса перед выпуском', unit: 'kg', type: 'number' },
        { key: 'massReleased', label: 'Масса выпущенная', unit: 'kg', type: 'number' },
      ],
    },
    {
      title: '11. ТЕХНОЛ. ОСТАТКИ',
      columns: 2,
      fields: [
        { key: 'deadRemainAfterRelease', label: 'Мёртвый ост. после выпуска', unit: 'kg (≤5)', type: 'number' },
        { key: 'cleanedFromPacking', label: 'Вычищено из фасовки', unit: 'kg', type: 'number' },
      ],
    },
    {
      title: '12. ДЛИТЕЛЬНОСТЬ',
      columns: 1,
      fields: [
        { key: 'brewDuration', label: 'Длительность варки', unit: 'мин', type: 'number' },
      ],
    },
    {
      title: '13. ФОРМЫ',
      columns: 1,
      fields: [
        { key: 'filledFormsCount', label: 'Кол-во заполн. форм', unit: 'шт', type: 'number' },
      ],
    },
    {
      title: '14. ОХЛАЖДЕНИЕ',
      columns: 2,
      fields: [
        { key: 'containerLoadTime', label: 'Время погрузки в контейнер', unit: 'ЧЧ:ММ', type: 'time' },
        { key: 'containerNumber', label: '№ контейнера', unit: '—', type: 'text' },
        { key: 'waterCoolRemoveTime', label: 'Время извл. из водн. охл.', unit: 'ЧЧ:ММ', type: 'time' },
        { key: 'actualBlocksCount', label: 'Кол-во блоков факт.', unit: 'шт', type: 'number' },
      ],
    },
    {
      title: '15. УПАКОВКА',
      columns: 1,
      fields: [
        { key: 'packagingType', label: 'Тип упаковки', unit: '—', type: 'text' },
      ],
    },
  ];

  constructor() {
    // Restore from localStorage
    const saved = this.loadFromStorage();
    if (saved) {
      this.form.patchValue(saved);
    }
  }

  /** Safe accessor for dynamic field key (avoids TS7053 in template) */
  getFieldValue(key: string): unknown {
    return (this.form.value as Record<string, unknown>)[key];
  }

  isFieldInvalid(key: string): boolean {
    const control = this.form.get(key);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onReview(): void {
    if (this.form.valid) {
      this.submitError.set(null);
      this.view.set('confirm');
    } else {
      this.form.markAllAsTouched();
    }
  }

  onEdit(): void {
    this.submitError.set(null);
    this.view.set('form');
  }

  onCancel(): void {
    this.form.reset();
    this.clearStorage();
    this.submitError.set(null);
    this.view.set('form');
  }

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) return;

    const data = this.form.value;
    this.saveToStorage(data);
    const payload = this.buildPayload(data);

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.http.post(environment.n8nBrewProtocolWebhookUrl, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.clearStorage();
        this.form.reset();
        this.view.set('form');
        this.isSuccess.set(true);
        setTimeout(() => this.isSuccess.set(false), 5000);
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.submitError.set(this.toSubmitError(err));
      },
    });
  }

  private buildPayload(data: typeof this.form.value): Record<string, unknown> {
    const totalInput = this.totalInputMass();
    const output = this.outputPercent();

    return {
      submittedAt: new Date().toISOString(),

      // 2. ВХОД: ЗЕРНО
      grainQuantity: data.grainQuantity ?? '',
      cagliataFat: data.cagliataFat ?? '',
      grainPH: data.grainPH ?? '',
      grainMoisture: data.grainMoisture ?? '',

      // 3. ВОЗВРАТ ИЗ ФАСОВКИ
      returnBrewNumber: data.returnBrewNumber ?? '',
      returnMass: data.returnMass ?? '',

      // 4. МЁРТВЫЙ ОСТАТОК
      deadRemainOnLoad: data.deadRemainOnLoad ?? '',

      // 5. СОЛЬ
      salt: data.salt ?? '',

      // 6. ПЛАВИТЕЛИ
      melter1Name: data.melter1Name ?? '',
      melter1Qty: data.melter1Qty ?? '',
      melter2Name: data.melter2Name ?? '',
      melter2Qty: data.melter2Qty ?? '',
      melter3Name: data.melter3Name ?? '',
      melter3Qty: data.melter3Qty ?? '',

      // 7. ПРОЧИЕ ИНГРЕДИЕНТЫ
      starch: data.starch ?? '',
      preservativeName: data.preservativeName ?? '',
      preservativeQty: data.preservativeQty ?? '',
      fatOil: data.fatOil ?? '',

      // 8. ВОДА
      waterDirect: data.waterDirect ?? '',
      steam: data.steam ?? '',

      // 9. ТЕМПЕРАТУРА
      tempAfterLoad: data.tempAfterLoad ?? '',
      maxTempHeat: data.maxTempHeat ?? '',
      tempBeforeRelease: data.tempBeforeRelease ?? '',

      // 10. МАССА В КОТЛЕ
      massAfterLoad: data.massAfterLoad ?? '',
      massBeforeRelease: data.massBeforeRelease ?? '',
      massReleased: data.massReleased ?? '',

      // 11. ТЕХНОЛ. ОСТАТКИ
      deadRemainAfterRelease: data.deadRemainAfterRelease ?? '',
      cleanedFromPacking: data.cleanedFromPacking ?? '',

      // 12. ДЛИТЕЛЬНОСТЬ
      brewDuration: data.brewDuration ?? '',

      // 13. ФОРМЫ
      filledFormsCount: data.filledFormsCount ?? '',

      // 14. ОХЛАЖДЕНИЕ
      containerLoadTime: data.containerLoadTime ?? '',
      containerNumber: data.containerNumber ?? '',
      waterCoolRemoveTime: data.waterCoolRemoveTime ?? '',
      actualBlocksCount: data.actualBlocksCount ?? '',

      // 15. УПАКОВКА
      packagingType: data.packagingType ?? '',

      // 16. РАСЧЁТ (АВТО)
      totalInputMass: totalInput,
      outputPercent: output,

      // ПРИМЕЧАНИЯ
      notes: (data.notes || '').trim(),
      operatorSignature: (data.operatorSignature || '').trim(),
    };
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

  private saveToStorage(data: unknown): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  private loadFromStorage(): Record<string, unknown> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }
}
